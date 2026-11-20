import AppKit
import Security
import SwiftUI

enum StepState {
    case done
    case needed
    case optional
}

@MainActor
struct SetupStep<Accessory: View>: View {
    let title: String
    let detail: String
    let state: StepState
    @ViewBuilder let accessory: () -> Accessory

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                Text(detail)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 12)
            accessory()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private var icon: String {
        switch state {
        case .done: return "checkmark.circle.fill"
        case .needed: return "exclamationmark.circle.fill"
        case .optional: return "info.circle.fill"
        }
    }

    private var color: Color {
        switch state {
        case .done: return .green
        case .needed: return .orange
        case .optional: return .blue
        }
    }
}

@MainActor
struct SetupView: View {
    @EnvironmentObject private var model: StarterModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(spacing: 16) {
                    AppIconView(size: 64)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Welcome to \(AppInfo.name)")
                            .font(.largeTitle.weight(.semibold))
                        Text("Let’s check a few things before you set up your projects.")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                }

                VStack(spacing: 0) {
                    if model.starterVersion == nil {
                        SetupStep(
                            title: "Starter files",
                            detail: "The rules couldn’t be unpacked into ~/claude-web-starter. Try again, or reinstall the app.",
                            state: .needed
                        ) {
                            Button("Try again") { Task { await model.start() } }
                        }
                        Divider()
                    }
                    SetupStep(
                        title: "Node.js",
                        detail: model.nodePath.map { "Installed at \($0)" } ?? "Needed to set up projects. Installs the official version from nodejs.org.",
                        state: model.nodePath == nil ? .needed : .done
                    ) {
                        if model.nodePath == nil {
                            if model.isInstallingNode {
                                ProgressView().controlSize(.small)
                            } else {
                                Button("Install Node.js") { Task { await model.installNode() } }
                                    .buttonStyle(.borderedProminent)
                            }
                        }
                    }
                    Divider()
                    SetupStep(
                        title: "Git",
                        detail: model.gitAvailable ? "Installed" : "Recommended. Needed for design skills and by Claude Code. Installs Apple’s Command Line Tools.",
                        state: model.gitAvailable ? .done : .optional
                    ) {
                        if !model.gitAvailable {
                            Button("Install Git") { model.installCommandLineTools() }
                        }
                    }
                    Divider()
                    SetupStep(
                        title: "Projects folder",
                        detail: folderDetail,
                        state: model.projects.isEmpty ? .needed : .done
                    ) {
                        Button("Choose…") { model.chooseProjectsFolder() }
                    }
                    Divider()
                    SetupStep(
                        title: "Claude’s language",
                        detail: "Claude explains, asks and reports in this language. Code, commits and pull requests stay in English.",
                        state: .done
                    ) {
                        Picker("Language", selection: $model.defaultLanguage) {
                            ForEach(StarterModel.languages, id: \.self) { Text($0).tag($0) }
                        }
                        .labelsHidden()
                        .fixedSize()
                    }
                }
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.primary.opacity(0.08)))

                HStack {
                    Text("You can change all of this later in Settings (⌘,).")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button {
                        model.confirmProjectsFolder()
                    } label: {
                        Text("Continue")
                            .frame(minWidth: 110)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .keyboardShortcut(.defaultAction)
                    .disabled(!model.canFinishSetup)
                }
            }
            .frame(maxWidth: 620)
            .padding(40)
            .frame(maxWidth: .infinity)
        }
    }

    private var folderDetail: String {
        let count = model.projects.count
        if count == 0 {
            return "No projects found in \(model.projectsFolderDisplay). Choose the folder that contains your projects."
        }
        return "\(model.projectsFolderDisplay) · \(count == 1 ? "1 project" : "\(count) projects") found"
    }
}
