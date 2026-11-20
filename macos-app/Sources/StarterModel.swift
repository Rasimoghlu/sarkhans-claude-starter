import AppKit
import Security
import SwiftUI

enum JobKind {
    case setUp
    case autoUpdate
    case repair
    case remove
    case setting
}

private final class JobBatch {
    let kind: JobKind
    let targets: [Project]
    var remaining: Int
    var failed: [Project] = []

    init(kind: JobKind, targets: [Project]) {
        self.kind = kind
        self.targets = targets
        remaining = targets.count
    }
}

private struct Job {
    let project: Project
    let steps: [[String]]
    let batch: JobBatch
    let key: String?
}

@MainActor
final class StarterModel: ObservableObject {
    static let appVersion = AppInfo.version

    @Published private(set) var projects: [Project] = []
    @Published private(set) var states: [String: InstallState] = [:]
    @Published private(set) var log = ""
    @Published private(set) var nodePath: String?
    @Published private(set) var gitAvailable = true
    @Published private(set) var claudeCodeAvailable = true
    @Published private(set) var teamFolder: String?
    @Published private(set) var teamName: String?
    @Published private(set) var isInstallingNode = false
    @Published private(set) var starterVersion: String?
    @Published private(set) var isLoading = false
    @Published private(set) var hasLoaded = false
    @Published private(set) var catalog: [CatalogItem] = []
    @Published private(set) var builtinSkills: [BuiltinSkill] = []
    @Published private(set) var notice: Notice?
    @Published private(set) var isProcessing = false
    @Published private(set) var availableUpdate: ReleaseInfo?
    @Published private(set) var updateStatus: String?
    @Published private(set) var isUpdating = false
    @Published private(set) var updatePhase = ""
    @Published private(set) var currentRulesHash: String?
    @Published var autoUpdateRules: Bool = UserDefaults.standard.object(forKey: "autoUpdateRules") as? Bool ?? true {
        didSet { UserDefaults.standard.set(autoUpdateRules, forKey: "autoUpdateRules") }
    }
    @Published var showingUpdate = false
    @Published private(set) var pendingKeys: Set<String> = []
    @Published private(set) var hasChosenFolder = UserDefaults.standard.string(forKey: "projectsFolder") != nil
    @Published var selection: Set<String> = []
    @Published var filter: ProjectFilter = .needsSetup
    @Published var searchText = ""
    @Published var showingActivity = false
    @Published var languageChoices: [String: String] = [:]
    @Published var defaultLanguage: String = UserDefaults.standard.string(forKey: "responseLanguage") ?? "English" {
        didSet { UserDefaults.standard.set(defaultLanguage, forKey: "responseLanguage") }
    }

    static let languages = [
        "English", "Azerbaijani", "Turkish", "Russian", "Ukrainian", "German", "French", "Spanish",
        "Italian", "Portuguese", "Dutch", "Polish", "Arabic", "Persian", "Chinese", "Japanese", "Korean",
    ]

    let home: String
    @Published private(set) var wwwPath: String
    let starterPath: String
    private let fileManager = FileManager.default
    private var didApplyInitialFilter = false
    private var noticeTask: Task<Void, Never>?
    private var queue: [Job] = []
    private var checkedForUpdates = false
    private var didAutoUpdateRules = false
    private var lastUpdateCheck: Date?
    private var announcedUpdateVersion: String?

    init() {
        home = FileManager.default.homeDirectoryForCurrentUser.path
        wwwPath = UserDefaults.standard.string(forKey: "projectsFolder") ?? home + "/www"
        starterPath = home + "/claude-web-starter"
    }

    var installerPath: String { starterPath + "/install.mjs" }
    var userCatalogPath: String { home + "/.claude-starter/my-skills.json" }
    var isBusy: Bool { isProcessing }
    var canRun: Bool { nodePath != nil && starterVersion != nil }
    var canFinishSetup: Bool { nodePath != nil && starterVersion != nil }
    var isReadyToUse: Bool { canFinishSetup && hasChosenFolder }

    var visibleProjects: [Project] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return projects.filter { project in
            matches(project, filter) && (query.isEmpty || project.name.localizedCaseInsensitiveContains(query))
        }
    }

    var selectedProjects: [Project] { projects.filter { selection.contains($0.id) } }
    var needsSetupProjects: [Project] { projects.filter { status(of: $0) != .ready } }

    var projectsFolderDisplay: String {
        wwwPath.hasPrefix(home) ? "~" + String(wwwPath.dropFirst(home.count)) : wwwPath
    }

    private var bundledZip: String? {
        Bundle.main.path(forResource: "claude-web-starter", ofType: "zip")
    }

    private var bundledVersion: String? {
        Bundle.main.path(forResource: "starter-version", ofType: "txt").flatMap(Self.readTrimmed)
    }

    func start() async {
        guard !isLoading else { return }
        isLoading = true
        await ensureStarter()
        loadCatalog()
        nodePath = await Task.detached(priority: .userInitiated) { NodeLocator.find() }.value
        gitAvailable = await Task.detached(priority: .userInitiated) { GitLocator.isAvailable() }.value
        claudeCodeAvailable = await Task.detached(priority: .userInitiated) { ClaudeCodeLocator.isAvailable() }.value
        loadTeam()
        currentRulesHash = await readRulesHash()
        refresh()
        if !didApplyInitialFilter {
            didApplyInitialFilter = true
            filter = projects.contains { status(of: $0) == .notSetUp } ? .needsSetup : .all
        }
        isLoading = false
        hasLoaded = true
        if !checkedForUpdates {
            checkedForUpdates = true
            announceUpdateIfNeeded()
            Task { await checkForUpdates(userInitiated: false) }
        }
        updateOutdatedRulesIfNeeded()
    }

    private func readRulesHash() async -> String? {
        guard let node = nodePath, starterVersion != nil else { return nil }
        let result = await Shell.runAsync(node, [installerPath, "--rules-hash"], timeout: 20, extraPath: (node as NSString).deletingLastPathComponent)
        guard result.succeeded,
              let line = result.output.split(separator: "\n").last?.trimmingCharacters(in: .whitespaces),
              line.count == 16, line.allSatisfy(\.isHexDigit)
        else { return nil }
        return line
    }

    private func updateOutdatedRulesIfNeeded() {
        guard !didAutoUpdateRules, autoUpdateRules, canRun else { return }
        didAutoUpdateRules = true
        let outdated = projects.filter { status(of: $0) == .updateAvailable && !isRunning($0) }
        guard !outdated.isEmpty else { return }
        enqueue(outdated.map { ($0, [installArguments(for: $0)]) }, kind: .autoUpdate)
    }

    func checkForUpdatesIfDue() async {
        if let last = lastUpdateCheck, Date().timeIntervalSince(last) < 600 { return }
        await checkForUpdates(userInitiated: false)
    }

    private func announceUpdateIfNeeded() {
        let defaults = UserDefaults.standard
        if let previous = defaults.string(forKey: "lastRunVersion"), Self.isOlder(previous, than: AppInfo.version) {
            log += "✔ Updated from \(previous) to \(AppInfo.version)\n\n"
            showNotice("Updated to \(AppInfo.version)", isError: false)
        }
        defaults.set(AppInfo.version, forKey: "lastRunVersion")
    }

    func checkForUpdates(userInitiated: Bool) async {
        guard Updater.repository != nil else {
            updateStatus = UpdateError.notConfigured.errorDescription
            return
        }
        lastUpdateCheck = Date()
        if userInitiated { updateStatus = "Checking…" }
        do {
            let release = try await Updater.latestRelease()
            if Self.isOlder(AppInfo.version, than: release.version) {
                availableUpdate = release
                updateStatus = "Version \(release.version) is available."
                NSApp.dockTile.badgeLabel = "1"
                if userInitiated {
                    showingUpdate = true
                } else if announcedUpdateVersion != release.version {
                    showNotice("Version \(release.version) is available. Press “Update” in the toolbar.", isError: false)
                }
                announcedUpdateVersion = release.version
            } else {
                availableUpdate = nil
                NSApp.dockTile.badgeLabel = nil
                updateStatus = "You’re up to date (\(AppInfo.version))."
                if userInitiated { showNotice("You’re up to date", isError: false) }
            }
        } catch {
            updateStatus = error.localizedDescription
            if userInitiated { showNotice(error.localizedDescription, isError: true) }
        }
    }

    func installUpdate() async {
        guard let release = availableUpdate, !isUpdating else { return }
        guard !isProcessing else {
            showNotice("Wait until the current work finishes, then update", isError: true)
            return
        }
        isUpdating = true
        do {
            setUpdatePhase("Downloading \(release.version)…")
            let zip = try await Updater.download(release)
            setUpdatePhase("Checking the download…")
            let prepared = try await Task.detached(priority: .userInitiated) { try Updater.prepareInstall(zip: zip) }.value
            if let command = prepared.adminCommand {
                setUpdatePhase("Waiting for your password…")
                try Updater.runWithAdministratorPrivileges(command)
            }
            setUpdatePhase("Restarting…")
            try Updater.launch(prepared.script)
            showingUpdate = false
            try? await Task.sleep(nanoseconds: 400_000_000)
            NSApp.terminate(nil)
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            exit(0)
        } catch UpdateError.cancelled {
            isUpdating = false
            showNotice("Update cancelled", isError: false)
        } catch {
            isUpdating = false
            log += "✖ Update failed: \(error.localizedDescription)\n\n"
            showNotice("Update failed: \(error.localizedDescription)", isError: true)
        }
    }

    private func setUpdatePhase(_ phase: String) {
        updatePhase = phase
        log += "… Update: \(phase)\n\n"
    }

    func openReleasePage() {
        if let url = availableUpdate?.pageURL {
            NSWorkspace.shared.open(url)
        }
    }

    func refresh() {
        let names = (try? fileManager.contentsOfDirectory(atPath: wwwPath)) ?? []
        projects = names
            .filter { !$0.hasPrefix(".") }
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
            .compactMap { self.makeProject(named: $0) }
        selection.formIntersection(projects.map(\.id))
    }

    func status(of project: Project) -> ProjectStatus {
        guard let installed = project.installedVersion else { return .notSetUp }
        if let current = currentRulesHash, let installedHash = project.rulesHash {
            return installedHash == current ? .ready : .updateAvailable
        }
        if let latest = starterVersion, Self.isOlder(installed, than: latest) { return .updateAvailable }
        return .ready
    }

    func displayStatus(of project: Project) -> DisplayStatus {
        if states[project.id] == .running { return .working }
        if states[project.id] == .failed { return .failed }
        switch status(of: project) {
        case .notSetUp: return .notSetUp
        case .updateAvailable: return .updateAvailable
        case .ready: return .ready
        }
    }

    func isRunning(_ project: Project) -> Bool {
        states[project.id] == .running
    }

    func count(in filter: ProjectFilter) -> Int {
        projects.filter { matches($0, filter) }.count
    }

    func count(status: ProjectStatus) -> Int {
        projects.filter { self.status(of: $0) == status }.count
    }

    private func matches(_ project: Project, _ filter: ProjectFilter) -> Bool {
        switch filter {
        case .needsSetup: return status(of: project) != .ready
        case .ready: return status(of: project) == .ready
        case .all: return true
        }
    }

    func pruneSelection() {
        selection.formIntersection(visibleProjects.map(\.id))
    }

    func project(withID id: String) -> Project? {
        projects.first { $0.id == id }
    }

    func language(for project: Project) -> String {
        project.responseLanguage ?? languageChoices[project.id] ?? defaultLanguage
    }

    func setUpTitle(for targets: [Project]) -> String {
        let newCount = targets.filter { status(of: $0) == .notSetUp }.count
        let updateCount = targets.filter { status(of: $0) == .updateAvailable }.count
        if newCount > 0 && updateCount > 0 { return "Set up \(newCount) and update \(updateCount)" }
        if newCount > 0 { return newCount == 1 ? "Set up 1 project" : "Set up \(newCount) projects" }
        return updateCount == 1 ? "Update 1 project" : "Update \(updateCount) projects"
    }

    func setUp(_ targets: [Project]) {
        let idle = targets.filter { !isRunning($0) }
        enqueue(idle.map { ($0, [installArguments(for: $0)]) }, kind: .setUp)
    }

    func repair(_ targets: [Project]) {
        let installed = targets.filter { $0.isInstalled && !isRunning($0) }
        guard !installed.isEmpty, confirmRepair(installed) else { return }
        enqueue(installed.map { project -> (Project, [[String]]) in
            let reinstall = [project.path, "--no-recommended", "--language", language(for: project)]
            let skills = project.catalogInstalled.sorted().map { [project.path, "--add-skill", $0] }
            return (project, [[project.path, "--uninstall"], reinstall] + skills)
        }, kind: .repair)
    }

    func remove(_ targets: [Project]) {
        let installed = targets.filter { $0.isInstalled && !isRunning($0) }
        guard !installed.isEmpty, confirmRemove(installed) else { return }
        enqueue(installed.map { ($0, [[$0.path, "--uninstall"]]) }, kind: .remove)
    }

    func setDesignLocked(_ locked: Bool, for targets: [Project]) {
        let mode = locked ? "locked" : "open"
        let changed = targets.filter { $0.isInstalled && $0.isDesignLocked != locked }
        mutate(changed) { $0.designMode = mode }
        enqueue(changed.map { ($0, [[$0.path, "--design", mode]]) }, kind: .setting) { "\($0.id)|design" }
    }

    func setPhase(_ phase: String, for targets: [Project]) {
        let changed = targets.filter { $0.isInstalled && $0.phase != phase }
        mutate(changed) { $0.phase = phase }
        enqueue(changed.map { ($0, [[$0.path, "--phase", phase]]) }, kind: .setting) { "\($0.id)|phase" }
    }

    func setWorkMode(_ mode: WorkMode, for targets: [Project]) {
        let changed = targets.filter { $0.isInstalled && $0.workMode != mode.rawValue }
        mutate(changed) { $0.preset = mode.rawValue }
        enqueue(changed.map { ($0, [[$0.path, "--preset", mode.rawValue]]) }, kind: .setting) { "\($0.id)|preset" }
    }

    func setLanguage(_ language: String, for targets: [Project]) {
        for project in targets where !project.isInstalled {
            languageChoices[project.id] = language
        }
        let changed = targets.filter { $0.isInstalled && $0.responseLanguage != language }
        mutate(changed) { $0.responseLanguage = language }
        enqueue(changed.map { ($0, [[$0.path, "--language", language]]) }, kind: .setting) { "\($0.id)|language" }
    }

    func setCatalogItem(_ item: CatalogItem, enabled: Bool, for targets: [Project]) {
        let changed = targets.filter { $0.isInstalled && $0.catalogInstalled.contains(item.id) != enabled }
        mutate(changed) { project in
            if enabled {
                project.catalogInstalled.insert(item.id)
            } else {
                project.catalogInstalled.remove(item.id)
            }
        }
        let flag = enabled ? "--add-skill" : "--remove-skill"
        enqueue(changed.map { ($0, [[$0.path, flag, item.id]]) }, kind: .setting) { "\($0.id)|\(item.id)" }
    }

    func isPending(_ item: CatalogItem, for project: Project) -> Bool {
        pendingKeys.contains("\(project.id)|\(item.id)")
    }

    func isRecommended(_ item: CatalogItem, for project: Project) -> Bool {
        switch item.recommended ?? "" {
        case "all": return true
        case "frontend": return project.hasFrontend
        case "react": return project.usesReact
        default: return false
        }
    }

    func recommendedItems(for project: Project) -> [CatalogItem] {
        catalog.filter { isRecommended($0, for: project) }
    }

    func otherItems(in category: String, for project: Project) -> [CatalogItem] {
        catalog.filter { $0.category == category && !isRecommended($0, for: project) }
    }

    func turnOnRecommended(for project: Project) {
        for item in recommendedItems(for: project) where !project.catalogInstalled.contains(item.id) {
            setCatalogItem(item, enabled: true, for: [project])
        }
    }

    var mySkills: [CatalogItem] { catalog.filter(\.isMine) }

    func registerSkill(source: String, pick: String?) async -> RegisterOutcome {
        guard let node = nodePath else { return .failed("Node.js is missing. Install it first.") }
        let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
        var arguments = [installerPath, "--register-skill", trimmed]
        if let pick { arguments += ["--pick", pick] }
        let result = await Shell.runAsync(node, arguments, extraPath: (node as NSString).deletingLastPathComponent)
        if result.status == 3,
           let line = result.output.split(separator: "\n").last(where: { $0.hasPrefix("{") }),
           let payload = try? JSONDecoder().decode([String: [SkillChoice]].self, from: Data(line.utf8)),
           let choices = payload["choices"], !choices.isEmpty {
            return .choices(choices)
        }
        appendLog(title: "Add skill \(trimmed)\(pick.map { " (\($0))" } ?? "")", result: result)
        guard result.succeeded else {
            let message = result.output
                .split(separator: "\n")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .first { $0.hasPrefix("✖") }
                .map { String($0.dropFirst()).trimmingCharacters(in: .whitespaces) }
            return .failed(message ?? "Couldn’t add the skill. See Activity for details.")
        }
        loadCatalog()
        let name = pick ?? catalog.last(where: \.isMine)?.name ?? "Skill"
        showNotice("\(name) added to your skills", isError: false)
        return .added(name)
    }

    func unregisterSkill(_ item: CatalogItem) {
        guard let node = nodePath, item.isMine else { return }
        guard confirm(
            title: "Remove “\(item.name)” from your skills?",
            message: "It disappears from the list. Projects that already have it keep their copy until you switch it off there first.",
            action: "Remove"
        ) else { return }
        Task {
            let result = await Shell.runAsync(node, [installerPath, "--unregister-skill", item.id], extraPath: (node as NSString).deletingLastPathComponent)
            appendLog(title: "Remove skill \(item.id)", result: result)
            loadCatalog()
            showNotice(result.succeeded ? "\(item.name) removed from your skills" : "Couldn’t remove \(item.name)", isError: !result.succeeded)
        }
    }

    var catalogCategories: [String] {
        var seen: [String] = []
        for item in catalog where !seen.contains(item.category) {
            seen.append(item.category)
        }
        return seen
    }

    func catalogItems(in category: String) -> [CatalogItem] {
        catalog.filter { $0.category == category }
    }

    static func categoryTitle(_ category: String) -> String {
        switch category {
        case "UI/UX": return "Design skills"
        case "Frontend": return "Frontend skills"
        case "MCP": return "Tools for Claude"
        default: return category
        }
    }

    func chooseProjectsFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Use This Folder"
        panel.message = "Choose the folder that contains your projects"
        panel.directoryURL = URL(fileURLWithPath: wwwPath)
        guard panel.runModal() == .OK, let url = panel.url else { return }
        wwwPath = url.path
        UserDefaults.standard.set(url.path, forKey: "projectsFolder")
        selection.removeAll()
        refresh()
        filter = needsSetupProjects.isEmpty ? .all : .needsSetup
    }

    private static let starterSettingsPath = NSHomeDirectory() + "/.claude-starter/settings.json"

    func loadTeam() {
        let folder = Self.readJSONObject(Self.starterSettingsPath)?["teamFolder"] as? String
        teamFolder = folder
        teamName = folder.map { (Self.readJSONObject($0 + "/team.json")?["name"] as? String) ?? ($0 as NSString).lastPathComponent }
    }

    func chooseTeamFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Use These Rules"
        panel.message = "Choose the team rules folder (team.json and/or a rules folder with .md files)"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task { await changeTeam(["--set-team", url.path]) }
    }

    func clearTeam() {
        Task { await changeTeam(["--clear-team"]) }
    }

    private func changeTeam(_ arguments: [String]) async {
        guard let node = nodePath else { return }
        let result = await Shell.runAsync(node, [installerPath] + arguments, timeout: 20, extraPath: (node as NSString).deletingLastPathComponent)
        appendLog(title: "Team rules", result: result)
        guard result.succeeded else {
            showNotice(result.output.trimmingCharacters(in: .whitespacesAndNewlines).components(separatedBy: "\n").last ?? "Couldn’t use that folder", isError: true)
            return
        }
        loadTeam()
        showNotice(teamName.map { "Team rules “\($0)” are on. Projects get them with their next update." } ?? "Team rules are off", isError: false)
        await refreshRulesHash()
    }

    func refreshRulesHash() async {
        let latest = await readRulesHash()
        guard latest != currentRulesHash else { return }
        currentRulesHash = latest
        refresh()
        didAutoUpdateRules = false
        updateOutdatedRulesIfNeeded()
    }

    func confirmProjectsFolder() {
        UserDefaults.standard.set(wwwPath, forKey: "projectsFolder")
        hasChosenFolder = true
    }

    func reveal(_ project: Project) {
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: project.path)])
    }

    var guardrailsThisWeek: Int {
        projects.compactMap { $0.guardrails?.weekTotal }.reduce(0, +)
    }

    func revealGuardrailLog(_ project: Project) {
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: project.path + GuardrailSummary.logPath)])
    }

    func installClaudeCode() {
        runInTerminal(
            name: "Install Claude Code",
            commands: "echo 'Installing Claude Code (official installer from claude.ai)…'; curl -fsSL https://claude.ai/install.sh | bash && echo && echo 'Done. Switch back to Sarkhans Claude Starter; it notices Claude Code by itself.'; exec /bin/zsh -li"
        )
    }

    private func runInTerminal(name: String, directory: String? = nil, commands: String) {
        let launcher = fileManager.temporaryDirectory.appendingPathComponent("\(name).command")
        let changeDirectory = directory.map { "cd " + Self.shellQuoted($0) + " || exit 1" } ?? ""
        let script = """
        #!/bin/zsh
        rm -f "$0"
        \(changeDirectory)
        exec /bin/zsh -lic \(Self.shellQuoted(commands))

        """
        do {
            try script.write(to: launcher, atomically: true, encoding: .utf8)
            try fileManager.setAttributes([.posixPermissions: 0o755], ofItemAtPath: launcher.path)
            NSWorkspace.shared.open(launcher)
        } catch {
            showNotice("Couldn’t open Terminal: \(error.localizedDescription)", isError: true)
        }
    }

    func openInClaudeCode(_ project: Project) {
        runInTerminal(
            name: "Open \(project.name) in Claude Code",
            directory: project.path,
            commands: "command -v claude >/dev/null && exec claude; echo; echo 'Claude Code is not installed yet. Install it from Sarkhans Claude Starter (Overview) or see https://code.claude.com/docs'; echo; exec /bin/zsh -li"
        )
    }

    private static func shellQuoted(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }

    nonisolated static func alwaysLoadedTokens(projectPath: String) -> Int {
        let fileManager = FileManager.default
        func read(_ path: String) -> String { (try? String(contentsOfFile: path, encoding: .utf8)) ?? "" }
        func frontmatter(_ text: String) -> String {
            guard text.hasPrefix("---"), let end = text.range(of: "\n---", range: text.index(text.startIndex, offsetBy: 3)..<text.endIndex) else { return "" }
            return String(text[text.startIndex..<end.lowerBound])
        }
        func descriptionLength(_ file: String) -> Int {
            let header = frontmatter(read(file))
            if header.contains("disable-model-invocation: true") { return 0 }
            return header.split(separator: "\n").first { $0.hasPrefix("description:") }?.count ?? 0
        }
        let claudeDir = projectPath + "/.claude"
        let claudeMd = read(projectPath + "/CLAUDE.md")
        var characters = claudeMd.count + read(NSHomeDirectory() + "/.claude/CLAUDE.md").count
        if claudeMd.contains("@AGENTS.md") { characters += read(projectPath + "/AGENTS.md").count }
        for rule in (try? fileManager.contentsOfDirectory(atPath: claudeDir + "/rules")) ?? [] where rule.hasSuffix(".md") {
            let text = read(claudeDir + "/rules/" + rule)
            if !frontmatter(text).contains("paths:") { characters += text.count }
        }
        for skill in (try? fileManager.contentsOfDirectory(atPath: claudeDir + "/skills")) ?? [] {
            characters += descriptionLength(claudeDir + "/skills/" + skill + "/SKILL.md")
        }
        for agent in (try? fileManager.contentsOfDirectory(atPath: claudeDir + "/agents")) ?? [] where agent.hasSuffix(".md") {
            characters += descriptionLength(claudeDir + "/agents/" + agent)
        }
        return characters / 4
    }

    func revealProjectsFolder() {
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: wwwPath)])
    }

    func clearLog() {
        log = ""
    }

    func dismissNotice() {
        noticeTask?.cancel()
        notice = nil
    }

    func installNode() async {
        guard !isInstallingNode else { return }
        isInstallingNode = true
        defer { isInstallingNode = false }
        log += "… Downloading the latest Node.js LTS installer from nodejs.org\n\n"
        do {
            let package = try await NodeInstaller.downloadLatestLTS()
            log += "✔ Downloaded \(package.lastPathComponent)\n\n"
            NSWorkspace.shared.open(package)
            showNotice("Finish the Node.js installer, then come back here", isError: false)
        } catch {
            log += "✖ Node.js download failed: \(error.localizedDescription)\n\n"
            showNotice("Couldn’t download Node.js. Install the LTS version from nodejs.org.", isError: true)
        }
    }

    func installCommandLineTools() {
        _ = Shell.run("/usr/bin/xcode-select", ["--install"], timeout: 15)
        log += "… Asked macOS to install the Command Line Tools (includes Git)\n\n"
        showNotice("Finish the macOS installer window, then come back here", isError: false)
    }

    private func mutate(_ targets: [Project], _ change: (inout Project) -> Void) {
        let ids = Set(targets.map(\.id))
        for index in projects.indices where ids.contains(projects[index].id) {
            change(&projects[index])
        }
    }

    private func installArguments(for project: Project, forceUpdate: Bool = true) -> [String] {
        if forceUpdate && project.isInstalled {
            return [project.path, "--force"]
        }
        return [project.path, "--language", language(for: project)]
    }

    private func enqueue(_ jobs: [(Project, [[String]])], kind: JobKind, key: ((Project) -> String)? = nil) {
        guard nodePath != nil, starterVersion != nil, !jobs.isEmpty else { return }
        let batch = JobBatch(kind: kind, targets: jobs.map { $0.0 })
        for (project, steps) in jobs {
            let jobKey = key?(project)
            if let jobKey { pendingKeys.insert(jobKey) }
            if kind != .setting { states[project.id] = .running }
            queue.append(Job(project: project, steps: steps, batch: batch, key: jobKey))
        }
        processQueue()
    }

    private func processQueue() {
        guard !isProcessing, let node = nodePath else { return }
        isProcessing = true
        let installer = installerPath
        let nodeDirectory = (node as NSString).deletingLastPathComponent

        Task { [self] in
            while !self.queue.isEmpty {
                let job = self.queue.removeFirst()
                var succeeded = true
                for step in job.steps where succeeded {
                    let result = await Shell.runAsync(node, [installer] + step, extraPath: nodeDirectory)
                    let flags = step.dropFirst().joined(separator: " ")
                    self.appendLog(title: flags.isEmpty ? job.project.name : "\(job.project.name) \(flags)", result: result)
                    succeeded = result.succeeded
                }
                if let key = job.key { self.pendingKeys.remove(key) }
                if job.batch.kind != .setting {
                    self.states[job.project.id] = succeeded ? .succeeded : .failed
                } else if !succeeded {
                    self.states[job.project.id] = .failed
                }
                if !succeeded { job.batch.failed.append(job.project) }
                job.batch.remaining -= 1
                if !self.queue.contains(where: { $0.project.id == job.project.id }) {
                    self.reloadProject(job.project.id)
                }
                if job.batch.remaining == 0 {
                    self.announce(kind: job.batch.kind, targets: job.batch.targets, failed: job.batch.failed)
                }
            }
            self.isProcessing = false
        }
    }

    private func reloadProject(_ id: String) {
        guard let index = projects.firstIndex(where: { $0.id == id }) else { return }
        if let fresh = makeProject(named: projects[index].name) {
            projects[index] = fresh
        } else {
            projects.remove(at: index)
        }
    }

    private func announce(kind: JobKind, targets: [Project], failed: [Project]) {
        if let first = failed.first {
            let text = targets.count == 1
                ? "\(first.name): something went wrong"
                : "\(failed.count) of \(targets.count) projects didn’t finish"
            showNotice(text, isError: true)
            return
        }
        let single = targets.count == 1 ? targets[0].name : nil
        let text: String
        switch kind {
        case .setUp: text = single.map { "\($0) is ready" } ?? "\(targets.count) projects are ready"
        case .autoUpdate: text = single.map { "New rules installed in \($0)" } ?? "New rules installed in \(targets.count) projects"
        case .repair: text = single.map { "\($0) repaired" } ?? "\(targets.count) projects repaired"
        case .remove: text = single.map { "Removed from \($0)" } ?? "Removed from \(targets.count) projects"
        case .setting: return
        }
        showNotice(text, isError: false)
    }

    private func showNotice(_ text: String, isError: Bool) {
        noticeTask?.cancel()
        notice = Notice(text: text, isError: isError)
        guard !isError else { return }
        noticeTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled else { return }
            self?.notice = nil
        }
    }

    private func confirmRemove(_ targets: [Project]) -> Bool {
        confirm(
            title: targets.count == 1 ? "Remove \(AppInfo.name) from “\(targets[0].name)”?" : "Remove \(AppInfo.name) from \(targets.count) projects?",
            message: "\(Self.nameList(targets))\n\nRules, hooks and skills are removed. CLAUDE.md is kept as CLAUDE.md.bak. Your code isn’t touched.",
            action: "Remove"
        )
    }

    private func confirmRepair(_ targets: [Project]) -> Bool {
        confirm(
            title: targets.count == 1 ? "Repair “\(targets[0].name)”?" : "Repair \(targets.count) projects?",
            message: "\(Self.nameList(targets))\n\nEverything is removed and set up again from scratch. CLAUDE.md is kept as CLAUDE.md.bak.",
            action: "Repair"
        )
    }

    private func confirm(title: String, message: String, action: String) -> Bool {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: action)
        alert.addButton(withTitle: "Cancel")
        return alert.runModal() == .alertFirstButtonReturn
    }

    private func loadCatalog() {
        var items: [CatalogItem] = []
        if let data = fileManager.contents(atPath: starterPath + "/skills-catalog.json"),
           let builtin = try? JSONDecoder().decode([CatalogItem].self, from: data) {
            items = builtin
        }
        if let data = fileManager.contents(atPath: userCatalogPath),
           let mine = try? JSONDecoder().decode([CatalogItem].self, from: data) {
            let known = Set(items.map(\.id))
            items += mine.filter { !known.contains($0.id) && $0.isMine }
        }
        catalog = items
        loadBuiltinSkills()
    }

    private func loadBuiltinSkills() {
        let directory = starterPath + "/template/.claude/skills"
        let names = (try? fileManager.contentsOfDirectory(atPath: directory)) ?? []
        builtinSkills = names.sorted().compactMap { name in
            guard let text = try? String(contentsOfFile: "\(directory)/\(name)/SKILL.md", encoding: .utf8) else { return nil }
            let summary = Self.builtinSummaries[name] ?? Self.firstSentence(Self.frontmatterValue(text, key: "description"))
            return BuiltinSkill(id: name, summary: summary)
        }
    }

    private static let builtinSummaries: [String: String] = [
        "add-api-route": "Add an API endpoint with auth, validation, error handling and tests.",
        "db-change": "Change the database schema safely: migration, models and tests.",
        "kickoff": "Plan a new project with you before any code is written.",
        "new-feature": "Build a feature end to end: plan, data, server, UI and tests.",
        "orchestrate": "Split a task across specialist agents and check every result.",
        "project-health": "Scan the whole project for problems and fix the safe ones.",
        "security-audit": "Security audit (OWASP Top 10) with evidence and fixes.",
        "ship": "Commit, push and open a pull request, only when you ask.",
        "ui-review": "Check the UI for accessibility, responsiveness and consistency.",
        "verify": "Run types, lint, tests and build for every stack in the project.",
        "write-tests": "Write behaviour-focused tests with the project's test framework.",
    ]

    nonisolated static func frontmatterValue(_ text: String, key: String) -> String {
        for line in text.split(separator: "\n", omittingEmptySubsequences: false).prefix(40) where line.hasPrefix("\(key):") {
            return String(line.dropFirst(key.count + 1))
                .trimmingCharacters(in: .whitespaces)
                .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
        }
        return ""
    }

    nonisolated static func firstSentence(_ text: String) -> String {
        guard let range = text.range(of: ". ") else { return text }
        return String(text[..<range.lowerBound]) + "."
    }

    private func ensureStarter() async {
        let installed = Self.readTrimmed(starterPath + "/VERSION")
        if let zip = bundledZip, let bundled = bundledVersion, Self.isOlder(installed, than: bundled) {
            if fileManager.fileExists(atPath: starterPath) {
                try? fileManager.removeItem(atPath: starterPath)
            }
            let result = await Shell.runAsync("/usr/bin/unzip", ["-oq", zip, "-d", home])
            appendLog(title: "Rules v\(bundled) → \(starterPath)", result: result)
        }
        let hasInstaller = fileManager.fileExists(atPath: installerPath)
        starterVersion = hasInstaller ? Self.readTrimmed(starterPath + "/VERSION") ?? "?" : nil
    }

    private static func readJSONObject(_ path: String) -> [String: Any]? {
        guard let data = FileManager.default.contents(atPath: path) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private func installedCatalogIDs(at path: String) -> Set<String> {
        var mcpServers: [String: Any] = [:]
        if let json = Self.readJSONObject(path + "/.mcp.json"),
           let servers = json["mcpServers"] as? [String: Any] {
            mcpServers = servers
        }
        var installed = Set<String>()
        for item in catalog {
            if item.type == "mcp" {
                if mcpServers[item.id] != nil { installed.insert(item.id) }
            } else if let skill = item.skill, fileManager.fileExists(atPath: "\(path)/.claude/skills/\(skill)/.catalog-source") {
                installed.insert(item.id)
            }
        }
        return installed
    }

    private func makeProject(named name: String) -> Project? {
        let path = wwwPath + "/" + name
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: path, isDirectory: &isDirectory), isDirectory.boolValue else { return nil }

        guard !Self.ignoredFolders.contains(name), !name.hasSuffix(".app") else { return nil }
        let entries = Set((try? fileManager.contentsOfDirectory(atPath: path)) ?? [])
        let detected = Self.stackMarkers
            .filter { marker in marker.files.contains { entries.contains($0) } || marker.extensions.contains { ext in entries.contains { $0.hasSuffix(ext) } } }
            .map { $0.label }
        let stacks = detected.isEmpty ? [entries.contains("index.html") ? "Static site" : "Other"] : detected

        let marker = Self.readTrimmed(path + "/.claude/starter-version")
        let legacy = fileManager.fileExists(atPath: path + "/.claude/hooks/guard-bash.mjs") ? "1.0" : nil
        let config = Self.readJSONObject(path + "/.claude/hooks/config.json")
        let packageJSON = Self.readJSONObject(path + "/package.json")
        let dependencies = (packageJSON?["dependencies"] as? [String: Any] ?? [:])
            .merging(packageJSON?["devDependencies"] as? [String: Any] ?? [:]) { first, _ in first }
        return Project(
            path: path,
            name: name,
            installedVersion: marker ?? legacy,
            stacks: stacks,
            catalogInstalled: installedCatalogIDs(at: path),
            phase: config?["projectPhase"] as? String,
            designMode: config?["designMode"] as? String,
            kickoffDone: fileManager.fileExists(atPath: path + "/.claude/KICKOFF.md"),
            responseLanguage: config?["responseLanguage"] as? String,
            hasFrontend: packageJSON != nil,
            usesReact: dependencies["react"] != nil || dependencies["next"] != nil,
            rulesHash: Self.readTrimmed(path + "/.claude/starter-hash"),
            preset: config?["preset"] as? String,
            orchestratorMode: config?["orchestratorMode"] as? String,
            contextTokens: (marker ?? legacy) == nil ? nil : Self.alwaysLoadedTokens(projectPath: path),
            guardrails: (marker ?? legacy) == nil ? nil : GuardrailSummary.load(projectPath: path)
        )
    }

    private func appendLog(title: String, result: CommandResult) {
        let mark = result.succeeded ? "✔" : "✖"
        let output = result.output.trimmingCharacters(in: .whitespacesAndNewlines)
        log += "\(mark) \(title)\n\(output)\n\n"
    }

    private static let stackMarkers: [(label: String, files: [String], extensions: [String])] = [
        ("PHP", ["composer.json"], []),
        ("Go", ["go.mod"], []),
        ("Python", ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "manage.py"], []),
        ("Node", ["package.json"], []),
        ("Rust", ["Cargo.toml"], []),
        ("Java", ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"], []),
        (".NET", [], [".sln", ".csproj", ".fsproj"]),
        ("Ruby", ["Gemfile"], []),
        ("Dart", ["pubspec.yaml"], []),
        ("Swift", ["Package.swift"], [".xcodeproj", ".xcworkspace"]),
        ("Docker", ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"], []),
    ]

    private static let ignoredFolders: Set<String> = ["node_modules", "vendor", "__pycache__", "venv", ".venv"]

    private static func nameList(_ targets: [Project]) -> String {
        let names = targets.prefix(12).map { "• \($0.name)" }
        let more = targets.count > 12 ? ["… and \(targets.count - 12) more"] : []
        return (names + more).joined(separator: "\n")
    }

    nonisolated static func readTrimmed(_ path: String) -> String? {
        guard let text = try? String(contentsOfFile: path, encoding: .utf8) else { return nil }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    nonisolated static func isOlder(_ version: String?, than other: String) -> Bool {
        guard let version else { return true }
        return version.compare(other, options: .numeric) == .orderedAscending
    }
}
