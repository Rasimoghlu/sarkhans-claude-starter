import AppKit
import Security
import SwiftUI

@MainActor
struct SkillSections: View {
    @EnvironmentObject private var model: StarterModel
    @State private var showingBuiltin = false
    @State private var showingAddSkill = false
    let project: Project

    var body: some View {
        let recommended = model.recommendedItems(for: project)
        let missing = recommended.filter { !project.catalogInstalled.contains($0.id) }

        Section {
            DisclosureGroup(isExpanded: $showingBuiltin) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(model.builtinSkills.enumerated()), id: \.element.id) { index, skill in
                        if index > 0 {
                            Divider()
                        }
                        BuiltinSkillRow(skill: skill)
                    }
                }
                .padding(.top, 6)
            } label: {
                Label("\(model.builtinSkills.count) built-in skills, always on", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.primary)
            }
        } header: {
            Text("Skills")
        } footer: {
            Text("Built-in skills come with \(AppInfo.name). Claude uses them on its own; you can also type one in Claude Code, for example /kickoff.")
        }

        if !recommended.isEmpty {
            Section {
                ForEach(recommended) { item in
                    SkillToggleRow(item: item, project: project)
                }
                if !missing.isEmpty {
                    HStack {
                        Text(missing.count == 1 ? "1 recommended item is off" : "\(missing.count) recommended items are off")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button("Turn on recommended") { model.turnOnRecommended(for: project) }
                            .disabled(!model.canRun)
                    }
                }
            } header: {
                Text("Recommended for this project")
            } footer: {
                Text("Chosen from the project’s stack and switched on when a project is set up. Tools need a one-time approval the next time Claude Code starts.")
            }
        }

        ForEach(model.catalogCategories.filter { $0 != CatalogItem.mySkills }, id: \.self) { category in
            let items = model.otherItems(in: category, for: project)
            if !items.isEmpty {
                Section {
                    ForEach(items) { item in
                        SkillToggleRow(item: item, project: project)
                    }
                } header: {
                    Text(StarterModel.categoryTitle(category))
                } footer: {
                    if category == "UI/UX" {
                        Text(designSkillsFooter)
                    } else if category == "MCP" {
                        Text("Claude Code asks you to approve tools the next time it starts in this project.")
                    }
                }
            }
        }

        Section {
            ForEach(model.mySkills) { item in
                SkillToggleRow(item: item, project: project)
            }
            Button {
                showingAddSkill = true
            } label: {
                Label("Add your own skill…", systemImage: "plus.circle")
            }
            .disabled(!model.canRun)
            .sheet(isPresented: $showingAddSkill) {
                AddSkillSheet()
                    .environmentObject(model)
            }
        } header: {
            Text("My skills")
        } footer: {
            Text(model.mySkills.isEmpty
                 ? "Add any skill from GitHub or from a folder on this Mac. It then shows up here in every project."
                 : "Your own skills, available in every project. Right-click one to remove it from the list.")
        }
    }

    private var designSkillsFooter: String {
        if project.phase == "new" {
            return "New project: during the kickoff conversation Claude suggests one design skill that fits and turns it on. Switch one on yourself if you already know the style. Use one at a time — several give Claude conflicting directions."
        }
        return "The design is \(project.isDesignLocked ? "protected" : "open"), so these only matter when you ask Claude for design work. Use one at a time — several give Claude conflicting directions."
    }
}

@MainActor
struct BuiltinSkillRow: View {
    let skill: BuiltinSkill

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text("/\(skill.id)")
                .font(.system(.callout, design: .monospaced).weight(.medium))
                .foregroundStyle(.primary)
                .frame(width: 150, alignment: .leading)
            Text(skill.summary)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

@MainActor
struct SkillToggleRow: View {
    @EnvironmentObject private var model: StarterModel
    let item: CatalogItem
    let project: Project

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(item.name)
                    if item.type == "mcp" {
                        Text("Tool")
                            .font(.caption2.weight(.medium))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Color.secondary.opacity(0.15), in: Capsule())
                            .foregroundStyle(.secondary)
                    }
                }
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 12)
            ZStack {
                if model.isPending(item, for: project) {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .frame(width: 18)
            Toggle("", isOn: Binding(
                get: { project.catalogInstalled.contains(item.id) },
                set: { model.setCatalogItem(item, enabled: $0, for: [project]) }
            ))
            .labelsHidden()
            .toggleStyle(.switch)
            .disabled(!model.canRun)
        }
        .contextMenu {
            if item.isMine {
                Button("Remove from my skills…") { model.unregisterSkill(item) }
            }
        }
    }
}

@MainActor
struct AddSkillSheet: View {
    @EnvironmentObject private var model: StarterModel
    @Environment(\.dismiss) private var dismiss
    @State private var source = ""
    @State private var choices: [SkillChoice] = []
    @State private var picked: String?
    @State private var errorMessage: String?
    @State private var isWorking = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Add your own skill")
                .font(.title2.weight(.semibold))
            Text("A skill is a folder with a SKILL.md file. Paste a GitHub link (a repository or a skill folder in it) or choose a folder on this Mac. It’s added to “My skills”, then you switch it on per project.")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                TextField("github.com/owner/repo or a folder path", text: $source)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { submit() }
                    .onChange(of: source) { _ in
                        choices = []
                        picked = nil
                        errorMessage = nil
                    }
                Button("Choose folder…") { chooseFolder() }
            }
            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !choices.isEmpty {
                Text("This source has \(choices.count) skills. Pick the one you want:")
                    .font(.headline)
                List(choices, selection: $picked) { choice in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(choice.name)
                        Text(choice.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    .padding(.vertical, 2)
                    .tag(choice.name)
                }
                .listStyle(.inset(alternatesRowBackgrounds: true))
                .frame(minHeight: 220)
            }
            Spacer(minLength: 0)
            HStack {
                if isWorking {
                    ProgressView()
                        .controlSize(.small)
                    Text("Checking the skill…")
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button(choices.isEmpty ? "Add" : "Add selected") { submit() }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
                    .disabled(isWorking || source.trimmingCharacters(in: .whitespaces).isEmpty || (!choices.isEmpty && picked == nil))
            }
        }
        .padding(22)
        .frame(width: 620, height: choices.isEmpty ? 280 : 560)
    }

    private func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Use This Folder"
        panel.message = "Choose a skill folder (with SKILL.md) or a folder that contains skills"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        source = url.path
    }

    private func submit() {
        guard !isWorking, !source.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        if !choices.isEmpty && picked == nil { return }
        isWorking = true
        errorMessage = nil
        let pick = choices.isEmpty ? nil : picked
        Task {
            let outcome = await model.registerSkill(source: source, pick: pick)
            isWorking = false
            switch outcome {
            case .added:
                dismiss()
            case .choices(let list):
                choices = list
                picked = list.first?.name
            case .failed(let message):
                errorMessage = message
            }
        }
    }
}
