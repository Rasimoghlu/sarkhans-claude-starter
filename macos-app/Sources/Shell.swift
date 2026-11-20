import AppKit
import Security
import SwiftUI

enum Shell {
    private static let basePath = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

    static func run(_ executable: String, _ arguments: [String], timeout: TimeInterval = 180, extraPath: String? = nil) -> CommandResult {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = extraPath.map { "\($0):\(Shell.basePath)" } ?? Shell.basePath
        process.environment = environment

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        do {
            try process.run()
        } catch {
            return CommandResult(status: -1, output: error.localizedDescription)
        }

        let watchdog = DispatchWorkItem {
            if process.isRunning { process.terminate() }
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + timeout, execute: watchdog)
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        watchdog.cancel()
        return CommandResult(status: process.terminationStatus, output: String(decoding: data, as: UTF8.self))
    }

    static func runAsync(_ executable: String, _ arguments: [String], timeout: TimeInterval = 180, extraPath: String? = nil) async -> CommandResult {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                continuation.resume(returning: Shell.run(executable, arguments, timeout: timeout, extraPath: extraPath))
            }
        }
    }
}

enum NodeLocator {
    static func find() -> String? {
        let fileManager = FileManager.default
        let home = fileManager.homeDirectoryForCurrentUser.path

        let shellResult = Shell.run("/bin/zsh", ["-lc", "command -v node"], timeout: 8)
        if shellResult.succeeded,
           let lastLine = shellResult.output.split(separator: "\n").last {
            let candidate = String(lastLine).trimmingCharacters(in: .whitespacesAndNewlines)
            if fileManager.isExecutableFile(atPath: candidate) { return candidate }
        }

        var candidates = [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "\(home)/.volta/bin/node",
            "\(home)/.asdf/shims/node",
            "\(home)/.local/share/mise/shims/node",
        ]
        candidates.append(contentsOf: versionedBinaries(root: "\(home)/.nvm/versions/node", suffix: "bin/node"))
        candidates.append(contentsOf: versionedBinaries(root: "\(home)/.local/share/fnm/node-versions", suffix: "installation/bin/node"))
        return candidates.first { fileManager.isExecutableFile(atPath: $0) }
    }

    private static func versionedBinaries(root: String, suffix: String) -> [String] {
        let versions = (try? FileManager.default.contentsOfDirectory(atPath: root)) ?? []
        return versions
            .sorted { $0.compare($1, options: .numeric) == .orderedDescending }
            .map { "\(root)/\($0)/\(suffix)" }
    }
}

enum GitLocator {
    static func isAvailable() -> Bool {
        let fileManager = FileManager.default
        if ["/opt/homebrew/bin/git", "/usr/local/bin/git"].contains(where: { fileManager.isExecutableFile(atPath: $0) }) {
            return true
        }
        if Shell.run("/usr/bin/xcode-select", ["-p"], timeout: 8).succeeded {
            return true
        }
        let result = Shell.run("/bin/zsh", ["-lc", "command -v git"], timeout: 8)
        let path = result.output
            .split(separator: "\n")
            .last
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) } ?? ""
        return result.succeeded && !path.isEmpty && path != "/usr/bin/git"
    }
}

enum ClaudeCodeLocator {
    static func isAvailable() -> Bool {
        let home = NSHomeDirectory()
        let candidates = [home + "/.local/bin/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude", home + "/.npm-global/bin/claude"]
        if candidates.contains(where: { FileManager.default.isExecutableFile(atPath: $0) }) {
            return true
        }
        let result = Shell.run("/bin/zsh", ["-lic", "command -v claude"], timeout: 8)
        return result.succeeded && result.output.contains("claude")
    }
}

enum NodeInstaller {
    private struct Release: Decodable {
        let version: String
        let files: [String]
        let isLTS: Bool

        enum CodingKeys: String, CodingKey { case version, files, lts }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            version = try container.decode(String.self, forKey: .version)
            files = try container.decodeIfPresent([String].self, forKey: .files) ?? []
            isLTS = (try? container.decode(String.self, forKey: .lts)) != nil
        }
    }

    static func downloadLatestLTS() async throws -> URL {
        guard let indexURL = URL(string: "https://nodejs.org/dist/index.json") else { throw URLError(.badURL) }
        let (data, _) = try await URLSession.shared.data(from: indexURL)
        let releases = try JSONDecoder().decode([Release].self, from: data)
        guard let release = releases.first(where: { $0.isLTS && $0.files.contains("osx-x64-pkg") }),
              let packageURL = URL(string: "https://nodejs.org/dist/\(release.version)/node-\(release.version).pkg")
        else { throw URLError(.resourceUnavailable) }

        let (downloaded, response) = try await URLSession.shared.download(from: packageURL)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        let target = FileManager.default.temporaryDirectory.appendingPathComponent("node-\(release.version).pkg")
        try? FileManager.default.removeItem(at: target)
        try FileManager.default.moveItem(at: downloaded, to: target)
        return target
    }
}
