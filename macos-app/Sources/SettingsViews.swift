import AppKit
import Security
import SwiftUI

@MainActor
struct NoticeBar: View {
    @EnvironmentObject private var model: StarterModel
    let notice: Notice

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: notice.isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .foregroundStyle(notice.isError ? Color.red : Color.green)
            Text(notice.text)
                .lineLimit(2)
            if notice.isError {
                Button("Show details") { model.showingActivity = true }
            }
            Button {
                model.dismissNotice()
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.borderless)
            .help("Dismiss")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(Color.primary.opacity(0.1)))
        .shadow(color: .black.opacity(0.12), radius: 10, y: 3)
    }
}

@MainActor
struct ActivityView: View {
    @EnvironmentObject private var model: StarterModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Activity")
                    .font(.title3.weight(.semibold))
                Spacer()
                Button("Copy") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(model.log, forType: .string)
                }
                .disabled(model.log.isEmpty)
                Button("Clear") { model.clearLog() }
                    .disabled(model.log.isEmpty)
                Button("Done") { dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
            ScrollView {
                Text(model.log.isEmpty ? "Nothing has happened yet." : model.log)
                    .font(.system(.callout, design: .monospaced))
                    .foregroundStyle(model.log.isEmpty ? Color.secondary : Color.primary)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
            }
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color.primary.opacity(0.08)))
        }
        .padding(20)
        .frame(width: 720, height: 480)
    }
}

@MainActor
struct SettingsView: View {
    @EnvironmentObject private var model: StarterModel
    @State private var showingAddSkill = false
    @State private var token = ""
    @State private var hasToken = GitHubToken.stored() != nil

    var body: some View {
        Form {
            Section {
                LabeledContent("Folder") {
                    HStack {
                        Text(model.projectsFolderDisplay)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Button("Change…") { model.chooseProjectsFolder() }
                    }
                }
                Toggle("Update project rules automatically", isOn: $model.autoUpdateRules)
            } header: {
                Text("Projects")
            } footer: {
                Text("When a new version brings new rules, set-up projects get them as soon as the app opens. Your project settings and skills stay as they are.")
            }
            Section {
                Picker("Claude replies in", selection: $model.defaultLanguage) {
                    ForEach(StarterModel.languages, id: \.self) { Text($0).tag($0) }
                }
            } header: {
                Text("New projects")
            } footer: {
                Text("Used when a project is set up. Each project can be changed later in its own settings.")
            }
            Section {
                if model.mySkills.isEmpty {
                    Text("None yet. Add a skill from GitHub or a folder on this Mac.")
                        .foregroundStyle(.secondary)
                }
                ForEach(model.mySkills) { item in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.name)
                            Text(item.path ?? item.repo ?? "")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        Spacer()
                        Button("Remove…") { model.unregisterSkill(item) }
                    }
                }
                Button("Add your own skill…") { showingAddSkill = true }
                    .disabled(!model.canRun)
            } header: {
                Text("My skills")
            }
            Section {
                if model.teams.isEmpty {
                    Text("No teams yet. Add your team’s shared rules folder to use the same rules in your projects.")
                        .foregroundStyle(.secondary)
                } else {
                    Picker("Default team", selection: Binding(
                        get: { model.defaultTeamFolder ?? TeamSetting.noTeam },
                        set: { folder in
                            if folder == TeamSetting.noTeam {
                                model.clearDefaultTeam()
                            } else if let team = model.teams.first(where: { $0.folder == folder }) {
                                model.makeDefault(team)
                            }
                        }
                    )) {
                        Text("None").tag(TeamSetting.noTeam)
                        ForEach(model.teams) { Text($0.exists ? $0.name : "\($0.name) (folder not found)").tag($0.folder) }
                    }
                    .disabled(!model.canRun)
                    ForEach(model.teams) { team in
                        TeamRow(team: team)
                    }
                }
                Button("Add team…") { model.addTeam() }
                    .disabled(!model.canRun)
            } header: {
                Text("Team rules")
            } footer: {
                Text("A team is a shared folder, such as a git repository, with your conventions as .md files in rules/ and an optional team.json (name, work mode, language, skills). The default team goes to every project; in a project’s page you can pick another team or none. When the folder changes, projects update by themselves.")
            }
            Section {
                LabeledContent("Version", value: AppInfo.version)
                LabeledContent("Source", value: Updater.repository.map { "github.com/\($0)" } ?? "Not set up in this build")
                HStack {
                    Text(model.updateStatus ?? "Checks automatically when the app opens.")
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer()
                    if model.availableUpdate != nil {
                        Button("Update…") { model.showingUpdate = true }
                            .buttonStyle(.borderedProminent)
                    }
                    Button("Check now") { Task { await model.checkForUpdates(userInitiated: true) } }
                        .disabled(Updater.repository == nil)
                }
                if hasToken {
                    HStack {
                        Label("GitHub token saved in Keychain", systemImage: "key.fill")
                        Spacer()
                        Button("Remove") {
                            GitHubToken.save("")
                            hasToken = false
                        }
                    }
                } else {
                    HStack {
                        SecureField("GitHub token (only for a private repository)", text: $token)
                        Button("Save") {
                            GitHubToken.save(token)
                            token = ""
                            hasToken = GitHubToken.stored() != nil
                        }
                        .disabled(token.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            } header: {
                Text("Updates")
            } footer: {
                Text("A token is needed only when the GitHub repository is private: a fine-grained token with read access to its contents. If GitHub CLI (gh) is signed in on this Mac, its login is used automatically.")
            }
            Section {
                LabeledContent("Rules", value: model.starterVersion ?? "Not found")
                LabeledContent("Node.js", value: model.nodePath ?? "Not found")
                LabeledContent("Git", value: model.gitAvailable ? "Installed" : "Not found")
                LabeledContent("Claude Code", value: model.claudeCodeAvailable ? "Installed" : "Not found")
                Button("Show activity…") { model.showingActivity = true }
            } header: {
                Text("About")
            }
        }
        .formStyle(.grouped)
        .frame(width: 540, height: 720)
        .sheet(isPresented: $showingAddSkill) {
            AddSkillSheet()
                .environmentObject(model)
        }
    }
}

@MainActor
struct UpdateSheet: View {
    @EnvironmentObject private var model: StarterModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let release = model.availableUpdate {
                HStack(spacing: 14) {
                    AppIconView(size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("A new version is available")
                            .font(.title2.weight(.semibold))
                        Text("\(AppInfo.name) \(release.version) — you have \(AppInfo.version).")
                            .foregroundStyle(.secondary)
                    }
                }
                if !release.notes.isEmpty {
                    Text("What’s new")
                        .font(.headline)
                    ScrollView {
                        Text(release.notes)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                    }
                    .frame(height: 180)
                    .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color.primary.opacity(0.08)))
                }
                Text("The app downloads the update and restarts. Your projects and settings stay as they are; projects that need the new rules then show “Update available”.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack {
                    Button("Release page") { model.openReleasePage() }
                        .buttonStyle(.link)
                    Spacer()
                    Button("Later") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                        .disabled(model.isUpdating)
                    Button {
                        Task { await model.installUpdate() }
                    } label: {
                        if model.isUpdating {
                            HStack(spacing: 6) {
                                ProgressView()
                                    .controlSize(.small)
                                Text(model.updatePhase.isEmpty ? "Updating…" : model.updatePhase)
                            }
                        } else {
                            Text("Update and restart")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
                    .disabled(model.isUpdating)
                }
            } else {
                Text("You’re up to date.")
                HStack {
                    Spacer()
                    Button("OK") { dismiss() }
                        .keyboardShortcut(.defaultAction)
                }
            }
        }
        .padding(22)
        .frame(width: 560)
    }
}

@MainActor
struct TeamRow: View {
    @EnvironmentObject private var model: StarterModel
    let team: TeamInfo

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(team.name)
                    if team.folder == model.defaultTeamFolder {
                        Text("Default")
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(Color.accentColor.opacity(0.15), in: Capsule())
                    }
                }
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(team.exists ? Color.secondary : Color.orange)
                Text(team.folder)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            Spacer()
            Button("Show") { NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: team.folder)]) }
                .disabled(!team.exists)
            Button("Remove…") { model.removeTeam(team) }
                .disabled(!model.canRun)
        }
    }

    private var detail: String {
        let users = model.projectCount(using: team)
        let usage = users == 0 ? "not used yet" : users == 1 ? "used by 1 project" : "used by \(users) projects"
        return "\(team.rulesSummary) · \(usage)"
    }
}
