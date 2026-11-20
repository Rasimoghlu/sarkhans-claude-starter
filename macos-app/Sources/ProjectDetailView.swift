import AppKit
import Security
import SwiftUI

@MainActor
struct ProjectDetailView: View {
    @EnvironmentObject private var model: StarterModel
    let projectID: String

    var body: some View {
        if let project = model.project(withID: projectID) {
            Form {
                Section {
                    ProjectHeader(project: project)
                }
                Section {
                    PrimaryActionView(project: project)
                }
                if project.isInstalled {
                    claudeSection(project)
                    designSection(project)
                    SkillSections(project: project)
                    maintenanceSection(project)
                } else {
                    claudeSection(project)
                }
            }
            .formStyle(.grouped)
        } else {
            OverviewView()
        }
    }

    private func claudeSection(_ project: Project) -> some View {
        Section {
            Picker("Claude replies in", selection: Binding(
                get: { model.language(for: project) },
                set: { model.setLanguage($0, for: [project]) }
            )) {
                ForEach(StarterModel.languages, id: \.self) { Text($0).tag($0) }
            }
            if project.isInstalled && model.status(of: project) != .updateAvailable {
                Picker("Work mode", selection: Binding(
                    get: { WorkMode(rawValue: project.workMode) ?? .standard },
                    set: { model.setWorkMode($0, for: [project]) }
                )) {
                    ForEach(WorkMode.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                Text((WorkMode(rawValue: project.workMode) ?? .standard).summary)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let tokens = project.contextTokens {
                LabeledContent("Rules in every session") {
                    Text("≈ \(tokens.formatted()) tokens")
                        .foregroundStyle(tokens > 6000 ? Color.orange : Color.secondary)
                }
            }
        } header: {
            Text("Claude")
        } footer: {
            Text(claudeFooter(project))
        }
    }

    private func claudeFooter(_ project: Project) -> String {
        var parts = ["Replies: explanations, questions and reports. Code, commits and pull requests stay in English."]
        if project.isInstalled && model.status(of: project) == .updateAvailable {
            parts.append("Update the project to choose a work mode.")
        }
        if project.contextTokens != nil {
            parts.append("“Rules in every session” is what Claude reads before your first message; fewer tokens leave more room for your code.")
        }
        return parts.joined(separator: " ")
    }

    private func designSection(_ project: Project) -> some View {
        Section {
            Toggle("Protect the current design", isOn: Binding(
                get: { project.isDesignLocked },
                set: { model.setDesignLocked($0, for: [project]) }
            ))
            Picker("Project type", selection: Binding(
                get: { project.phase == "new" ? "new" : "existing" },
                set: { model.setPhase($0, for: [project]) }
            )) {
                Text("Existing").tag("existing")
                Text("New").tag("new")
            }
            .pickerStyle(.segmented)
        } header: {
            Text("Design")
        } footer: {
            Text(designFooter(project))
        }
    }

    private func designFooter(_ project: Project) -> String {
        var parts = [project.isDesignLocked
            ? "Claude won’t change colors, fonts, spacing or layout unless you ask."
            : "Claude may change the design."]
        if project.phase == "new" {
            parts.append(project.kickoffDone
                ? "New project: the plan agreed with Claude is in .claude/KICKOFF.md."
                : "New project: Claude plans the product and design with you before writing code. Open the project in Claude Code to start.")
        } else {
            parts.append("Existing project: Claude follows what’s already there.")
        }
        return parts.joined(separator: " ")
    }

    private func maintenanceSection(_ project: Project) -> some View {
        Section {
            MaintenanceRow(
                title: "Repair",
                detail: "Set everything up again from scratch if something seems broken.",
                buttonTitle: "Repair…",
                isDestructive: false
            ) {
                model.repair([project])
            }
            MaintenanceRow(
                title: "Remove from this project",
                detail: "Removes rules, hooks and skills. Your code isn’t touched.",
                buttonTitle: "Remove…",
                isDestructive: true
            ) {
                model.remove([project])
            }
        } header: {
            Text("Maintenance")
        }
    }
}

@MainActor
struct ProjectHeader: View {
    @EnvironmentObject private var model: StarterModel
    let project: Project

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: "folder.fill")
                .font(.system(size: 34))
                .foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 6) {
                Text(project.name)
                    .font(.title2.weight(.semibold))
                    .lineLimit(1)
                    .truncationMode(.middle)
                HStack(spacing: 6) {
                    StatusPill(status: model.displayStatus(of: project))
                    ForEach(project.stacks, id: \.self) { StackTag(label: $0) }
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 6) {
                if project.isInstalled {
                    Button {
                        model.openInClaudeCode(project)
                    } label: {
                        Label("Open in Claude Code", systemImage: "terminal")
                    }
                    .help("Opens Terminal in this project folder and starts Claude Code")
                }
                Button("Show in Finder") { model.reveal(project) }
                    .buttonStyle(.link)
            }
        }
        .padding(.vertical, 4)
    }
}

@MainActor
struct PrimaryActionView: View {
    @EnvironmentObject private var model: StarterModel
    let project: Project

    var body: some View {
        switch model.displayStatus(of: project) {
        case .working:
            HStack(spacing: 10) {
                ProgressView()
                    .controlSize(.small)
                Text("Working on it…")
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 6)
        case .notSetUp:
            actionRow(
                text: "Adds Claude’s rules, agents and safety checks to this project. Your code isn’t changed.",
                button: "Set up project"
            )
        case .updateAvailable:
            actionRow(
                text: "Newer rules are available (\(project.installedVersion ?? "?") → \(model.starterVersion ?? "?")). Your settings are kept.",
                button: "Update"
            )
        case .ready:
            HStack(spacing: 12) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.title)
                    .foregroundStyle(.green)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Ready")
                        .font(.headline)
                    Text("Claude Code follows these rules whenever you work in this project.")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
        case .failed:
            VStack(alignment: .leading, spacing: 10) {
                Label("The last action didn’t finish.", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                HStack {
                    Button("Show details") { model.showingActivity = true }
                    Button("Try again") { model.setUp([project]) }
                        .disabled(!model.canRun)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func actionRow(text: String, button: String) -> some View {
        HStack(alignment: .center, spacing: 16) {
            Text(text)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 12)
            Button {
                model.setUp([project])
            } label: {
                Text(button)
                    .frame(minWidth: 110)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!model.canRun)
        }
        .padding(.vertical, 4)
    }
}

@MainActor
struct MaintenanceRow: View {
    let title: String
    let detail: String
    let buttonTitle: String
    let isDestructive: Bool
    let action: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if isDestructive {
                Button(buttonTitle, role: .destructive, action: action)
                    .foregroundStyle(.red)
            } else {
                Button(buttonTitle, action: action)
            }
        }
    }
}

@MainActor
struct BulkDetailView: View {
    @EnvironmentObject private var model: StarterModel
    let projects: [Project]

    var body: some View {
        let pending = projects.filter { model.status(of: $0) != .ready }
        let installed = projects.filter(\.isInstalled)
        Form {
            Section {
                HStack(spacing: 14) {
                    Image(systemName: "square.stack.3d.up.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(Color.accentColor)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(projects.count) projects selected")
                            .font(.title2.weight(.semibold))
                        Text(projects.map(\.name).joined(separator: ", "))
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                            .truncationMode(.tail)
                    }
                }
                .padding(.vertical, 4)
            }
            Section {
                if pending.isEmpty {
                    Label("All selected projects are ready", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                } else {
                    HStack {
                        Text("Set up or update everything selected in one go.")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button(model.setUpTitle(for: pending)) { model.setUp(pending) }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.large)
                            .disabled(!model.canRun)
                    }
                }
            }
            if !installed.isEmpty {
                Section {
                    Picker("Claude replies in", selection: Binding(
                        get: { commonLanguage(installed) },
                        set: { model.setLanguage($0, for: installed) }
                    )) {
                        if commonLanguage(installed).isEmpty {
                            Text("Mixed").tag("")
                        }
                        ForEach(StarterModel.languages, id: \.self) { Text($0).tag($0) }
                    }
                    HStack {
                        Text("Work mode")
                        Spacer()
                        ForEach(WorkMode.allCases) { mode in
                            Button(mode.title) { model.setWorkMode(mode, for: installed.filter { model.status(of: $0) != .updateAvailable }) }
                        }
                    }
                    HStack {
                        Text("Design")
                        Spacer()
                        Button("Protect current design") { model.setDesignLocked(true, for: installed) }
                        Button("Allow design changes") { model.setDesignLocked(false, for: installed) }
                    }
                } header: {
                    Text("Settings for \(installed.count) set-up \(installed.count == 1 ? "project" : "projects")")
                }
                .disabled(!model.canRun)
                ForEach(model.catalogCategories, id: \.self) { category in
                    Section {
                        ForEach(model.catalogItems(in: category)) { item in
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.name)
                                    Text("In \(installed.filter { $0.catalogInstalled.contains(item.id) }.count) of \(installed.count)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button("Add") { model.setCatalogItem(item, enabled: true, for: installed) }
                                Button("Remove") { model.setCatalogItem(item, enabled: false, for: installed) }
                            }
                        }
                    } header: {
                        Text(StarterModel.categoryTitle(category))
                    }
                    .disabled(!model.canRun)
                }
                Section {
                    MaintenanceRow(
                        title: "Repair \(installed.count)",
                        detail: "Set everything up again from scratch.",
                        buttonTitle: "Repair…",
                        isDestructive: false
                    ) {
                        model.repair(installed)
                    }
                    MaintenanceRow(
                        title: "Remove from \(installed.count)",
                        detail: "Removes rules, hooks and skills. Code isn’t touched.",
                        buttonTitle: "Remove…",
                        isDestructive: true
                    ) {
                        model.remove(installed)
                    }
                } header: {
                    Text("Maintenance")
                }
                .disabled(!model.canRun)
            }
        }
        .formStyle(.grouped)
    }

    private func commonLanguage(_ targets: [Project]) -> String {
        let languages = Set(targets.map { model.language(for: $0) })
        return languages.count == 1 ? languages.first ?? "" : ""
    }
}
