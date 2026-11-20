import AppKit
import Security
import SwiftUI

enum AppInfo {
    static let name = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "Sarkhans Claude Starter"
    static let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
}

struct ReleaseInfo: Equatable {
    let version: String
    let notes: String
    let pageURL: URL
    let downloadURL: URL
    let assetAPIURL: URL
    let token: String?
}

enum UpdateError: LocalizedError {
    case notConfigured
    case notFound(String)
    case http(Int)
    case noAsset
    case invalidBundle(String)
    case translocated
    case cancelled
    case adminFailed(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Updates aren’t set up in this build."
        case .notFound(let repo): return "No release found on github.com/\(repo). If the repository is private, add a GitHub token in Settings."
        case .http(let code): return "GitHub answered with HTTP \(code). Try again later."
        case .noAsset: return "The latest release has no app download (.zip)."
        case .invalidBundle(let reason): return "The downloaded app didn’t pass a check: \(reason)."
        case .translocated: return "Open the app from your Applications folder, not from the downloaded installer, then update."
        case .cancelled: return "Update cancelled."
        case .adminFailed(let reason): return "The update couldn’t be installed: \(reason)"
        }
    }
}

enum GitHubToken {
    private static let service = "SarkhansClaudeStarter.github"
    private static let account = "token"

    private static var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }

    static func stored() -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        let token = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
        return token.isEmpty ? nil : token
    }

    static func save(_ token: String) {
        SecItemDelete(baseQuery as CFDictionary)
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        var attributes = baseQuery
        attributes[kSecValueData as String] = Data(trimmed.utf8)
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func resolve() -> String? {
        if let token = stored() { return token }
        let result = Shell.run("/bin/zsh", ["-lc", "command -v gh >/dev/null 2>&1 && gh auth token 2>/dev/null"], timeout: 8)
        let token = result.output.split(separator: "\n").last.map { String($0).trimmingCharacters(in: .whitespaces) } ?? ""
        return result.succeeded && !token.isEmpty && !token.contains(" ") ? token : nil
    }
}

private final class StripAuthorizationOnRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        var next = request
        if next.url?.host != task.originalRequest?.url?.host {
            next.setValue(nil, forHTTPHeaderField: "Authorization")
        }
        completionHandler(next)
    }
}

struct PreparedUpdate: Sendable {
    let script: URL
    let adminCommand: String?
}

enum Updater {
    static let repository: String? = Bundle.main.path(forResource: "update-repo", ofType: "txt")
        .flatMap(StarterModel.readTrimmed)
        .flatMap { $0.contains("/") ? $0 : nil }

    private struct Release: Decodable {
        let tagName: String
        let body: String?
        let htmlURL: URL
        let assets: [Asset]

        enum CodingKeys: String, CodingKey {
            case tagName = "tag_name"
            case body
            case htmlURL = "html_url"
            case assets
        }
    }

    private struct Asset: Decodable {
        let name: String
        let url: URL
        let browserDownloadURL: URL

        enum CodingKeys: String, CodingKey {
            case name
            case url
            case browserDownloadURL = "browser_download_url"
        }
    }

    static func latestRelease() async throws -> ReleaseInfo {
        guard let repo = repository, let url = URL(string: "https://api.github.com/repos/\(repo)/releases/latest") else {
            throw UpdateError.notConfigured
        }
        var token: String?
        var (status, data) = try await get(url, token: nil)
        if [401, 403, 404].contains(status) {
            token = await Task.detached(priority: .utility) { GitHubToken.resolve() }.value
            if let token {
                (status, data) = try await get(url, token: token)
            }
        }
        if status == 404 { throw UpdateError.notFound(repo) }
        guard status == 200 else { throw UpdateError.http(status) }
        let release = try JSONDecoder().decode(Release.self, from: data)
        guard let asset = release.assets.first(where: { $0.name.hasSuffix(".zip") }) else { throw UpdateError.noAsset }
        let version = release.tagName.hasPrefix("v") ? String(release.tagName.dropFirst()) : release.tagName
        return ReleaseInfo(
            version: version,
            notes: release.body ?? "",
            pageURL: release.htmlURL,
            downloadURL: asset.browserDownloadURL,
            assetAPIURL: asset.url,
            token: token
        )
    }

    private static func get(_ url: URL, token: String?) async throws -> (Int, Data) {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData)
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("SarkhansClaudeStarter/\(AppInfo.version)", forHTTPHeaderField: "User-Agent")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.shared.data(for: request)
        return ((response as? HTTPURLResponse)?.statusCode ?? 0, data)
    }

    static func download(_ release: ReleaseInfo) async throws -> URL {
        var request = URLRequest(url: release.token == nil ? release.downloadURL : release.assetAPIURL)
        request.timeoutInterval = 120
        request.setValue("SarkhansClaudeStarter/\(AppInfo.version)", forHTTPHeaderField: "User-Agent")
        if let token = release.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/octet-stream", forHTTPHeaderField: "Accept")
        }
        let (file, response) = try await URLSession.shared.download(for: request, delegate: StripAuthorizationOnRedirect())
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else { throw UpdateError.http(status) }
        let target = FileManager.default.temporaryDirectory.appendingPathComponent("SarkhansClaudeStarter-\(release.version).zip")
        try? FileManager.default.removeItem(at: target)
        try FileManager.default.moveItem(at: file, to: target)
        return target
    }

    static func prepareInstall(zip: URL) throws -> PreparedUpdate {
        let fileManager = FileManager.default
        let work = fileManager.temporaryDirectory.appendingPathComponent("SarkhansUpdate-\(UUID().uuidString)")
        try fileManager.createDirectory(at: work, withIntermediateDirectories: true)
        guard Shell.run("/usr/bin/ditto", ["-x", "-k", zip.path, work.path], timeout: 120).succeeded else {
            throw UpdateError.invalidBundle("the download couldn’t be unpacked")
        }
        let contents = (try? fileManager.contentsOfDirectory(at: work, includingPropertiesForKeys: nil)) ?? []
        guard let newApp = contents.first(where: { $0.pathExtension == "app" }) else {
            throw UpdateError.invalidBundle("no app inside the download")
        }
        guard Bundle(url: newApp)?.bundleIdentifier == Bundle.main.bundleIdentifier else {
            throw UpdateError.invalidBundle("it’s a different app")
        }
        guard Shell.run("/usr/bin/codesign", ["--verify", "--deep", "--strict", newApp.path], timeout: 60).succeeded else {
            throw UpdateError.invalidBundle("its signature is broken")
        }
        let current = Bundle.main.bundleURL
        if current.path.contains("/AppTranslocation/") {
            throw UpdateError.translocated
        }
        _ = Shell.run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", newApp.path], timeout: 30)
        let target = shellQuote(current.path)
        let backup = shellQuote(current.path + ".old")
        let replacement = shellQuote(newApp.path)
        let swap = "/bin/rm -rf \(backup); /bin/mv \(target) \(backup) && { /bin/mv \(replacement) \(target) || { /bin/mv \(backup) \(target); exit 1; }; } && /bin/rm -rf \(backup)"
        let parent = current.deletingLastPathComponent()
        let writable = fileManager.isWritableFile(atPath: parent.path) && fileManager.isWritableFile(atPath: current.path)
        let script = work.appendingPathComponent("install.sh")
        let text = """
        #!/bin/bash
        PID=\(ProcessInfo.processInfo.processIdentifier)
        for _ in $(/usr/bin/seq 1 50); do /bin/kill -0 $PID 2>/dev/null || break; /bin/sleep 0.2; done
        /bin/kill $PID 2>/dev/null
        for _ in $(/usr/bin/seq 1 25); do /bin/kill -0 $PID 2>/dev/null || break; /bin/sleep 0.2; done
        /bin/kill -9 $PID 2>/dev/null
        /bin/sleep 0.3
        \(writable ? swap : ":")
        /usr/bin/open \(target)
        """
        try text.write(to: script, atomically: true, encoding: .utf8)
        return PreparedUpdate(script: script, adminCommand: writable ? nil : swap)
    }

    @MainActor
    static func runWithAdministratorPrivileges(_ command: String) throws {
        let escaped = command
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let prompt = "\(AppInfo.name) needs your password to install the update."
        let source = "do shell script \"\(escaped)\" with prompt \"\(prompt)\" with administrator privileges"
        guard let script = NSAppleScript(source: source) else {
            throw UpdateError.adminFailed("couldn’t ask for permission")
        }
        var error: NSDictionary?
        _ = script.executeAndReturnError(&error)
        if let error {
            if (error[NSAppleScript.errorNumber] as? Int) == -128 {
                throw UpdateError.cancelled
            }
            throw UpdateError.adminFailed(error[NSAppleScript.errorMessage] as? String ?? "unknown error")
        }
    }

    static func launch(_ script: URL) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = [script.path]
        try process.run()
    }

    private static func shellQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}
