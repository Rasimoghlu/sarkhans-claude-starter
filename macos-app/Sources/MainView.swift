import AppKit
import Security
import SwiftUI

@MainActor
struct MainView: View {
    @EnvironmentObject private var model: StarterModel

    var body: some View {
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 300, ideal: 340, max: 460)
        } detail: {
            DetailContainer()
        }
        .navigationTitle(AppInfo.name)
        .navigationSubtitle(model.projectsFolderDisplay)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                if let update = model.availableUpdate {
                    Button {
                        model.showingUpdate = true
                    } label: {
                        Label("Update to \(update.version)", systemImage: "arrow.down.circle.fill")
                            .labelStyle(.titleAndIcon)
                    }
                    .buttonStyle(.borderedProminent)
                    .help("A new version of \(AppInfo.name) is available")
                }
                if model.isBusy {
                    ProgressView()
                        .controlSize(.small)
                }
                Menu {
                    Button("Choose another folder…") { model.chooseProjectsFolder() }
                    Button("Show in Finder") { model.revealProjectsFolder() }
                } label: {
                    Label("Projects folder", systemImage: "folder")
                }
                .help("Projects folder: \(model.projectsFolderDisplay)")
                .disabled(model.isBusy)
                Button {
                    Task { await model.start() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .help("Refresh (⌘R)")
                .keyboardShortcut("r")
                .disabled(model.isBusy)
                Button {
                    model.showingActivity = true
                } label: {
                    Label("Activity", systemImage: "list.bullet.rectangle")
                }
                .help("Details of what the app did")
            }
        }
    }
}

@MainActor
struct SidebarView: View {
    @EnvironmentObject private var model: StarterModel

    var body: some View {
        VStack(spacing: 0) {
            Picker("Show", selection: $model.filter) {
                ForEach(ProjectFilter.allCases) { option in
                    Text("\(option.title) \(model.count(in: option))").tag(option)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .padding(.horizontal, 10)
            .padding(.vertical, 8)

            if model.visibleProjects.isEmpty {
                SidebarEmptyState()
            } else {
                List(selection: $model.selection) {
                    ForEach(model.visibleProjects) { project in
                        ProjectRow(project: project)
                            .tag(project.id)
                    }
                }
                .listStyle(.sidebar)
            }
        }
        .searchable(text: $model.searchText, placement: .sidebar, prompt: "Search projects")
        .safeAreaInset(edge: .bottom, spacing: 0) {
            SidebarFooter()
        }
        .onChange(of: model.filter) { _ in model.pruneSelection() }
        .onChange(of: model.searchText) { _ in model.pruneSelection() }
    }
}

@MainActor
struct SidebarFooter: View {
    @EnvironmentObject private var model: StarterModel

    var body: some View {
        let pending = model.needsSetupProjects
        if !pending.isEmpty {
            VStack(spacing: 0) {
                Divider()
                Button {
                    model.setUp(pending)
                } label: {
                    Label(model.setUpTitle(for: pending), systemImage: "wand.and.stars")
                        .frame(maxWidth: .infinity)
                }
                .controlSize(.large)
                .disabled(!model.canRun)
                .padding(10)
            }
            .background(.bar)
        }
    }
}

@MainActor
struct SidebarEmptyState: View {
    @EnvironmentObject private var model: StarterModel

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 34))
                .foregroundStyle(iconColor)
            Text(title)
                .font(.headline)
                .multilineTextAlignment(.center)
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if model.projects.isEmpty {
                Button("Choose folder…") { model.chooseProjectsFolder() }
                    .buttonStyle(.borderedProminent)
            } else if model.searchText.isEmpty && model.filter != .all {
                Button("Show all projects") { model.filter = .all }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var icon: String {
        if model.projects.isEmpty { return "folder.badge.questionmark" }
        if !model.searchText.isEmpty { return "magnifyingglass" }
        return model.filter == .needsSetup ? "checkmark.seal.fill" : "tray"
    }

    private var iconColor: Color {
        model.filter == .needsSetup && !model.projects.isEmpty && model.searchText.isEmpty ? .green : .secondary
    }

    private var title: String {
        if model.projects.isEmpty { return "No projects in \(model.projectsFolderDisplay)" }
        if !model.searchText.isEmpty { return "No matches" }
        return model.filter == .needsSetup ? "Everything is set up" : "Nothing is set up yet"
    }

    private var message: String {
        if model.projects.isEmpty {
            return "Choose the folder that contains your projects. Every folder inside it is listed."
        }
        if !model.searchText.isEmpty { return "No project name contains “\(model.searchText)”." }
        return model.filter == .needsSetup
            ? "All projects have the latest rules."
            : "Set up a project from “Needs setup”."
    }
}

@MainActor
struct ProjectRow: View {
    @EnvironmentObject private var model: StarterModel
    let project: Project

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "folder.fill")
                .foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(project.name)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Text(project.stacks.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 6)
            StatusPill(status: model.displayStatus(of: project))
        }
        .padding(.vertical, 3)
        .contextMenu {
            Button(project.isInstalled ? "Update" : "Set up") { model.setUp([project]) }
                .disabled(!model.canRun)
            Button("Show in Finder") { model.reveal(project) }
            if project.isInstalled {
                Divider()
                Button("Repair…") { model.repair([project]) }
                    .disabled(!model.canRun)
                Button("Remove…") { model.remove([project]) }
                    .disabled(!model.canRun)
            }
        }
    }
}

@MainActor
struct StatusPill: View {
    let status: DisplayStatus

    var body: some View {
        HStack(spacing: 4) {
            if status == .working {
                ProgressView()
                    .controlSize(.mini)
            } else {
                Image(systemName: status.icon)
            }
            Text(status.title)
        }
        .font(.caption.weight(.medium))
        .lineLimit(1)
        .fixedSize()
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(status.color.opacity(0.14), in: Capsule())
        .foregroundStyle(status.color)
    }
}

@MainActor
struct StackTag: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color.secondary.opacity(0.12), in: Capsule())
            .foregroundStyle(.secondary)
    }
}

@MainActor
struct DetailContainer: View {
    @EnvironmentObject private var model: StarterModel

    var body: some View {
        ZStack(alignment: .bottom) {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if let notice = model.notice {
                NoticeBar(notice: notice)
                    .padding(18)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeOut(duration: 0.2), value: model.notice)
    }

    @ViewBuilder
    private var content: some View {
        let selected = model.selectedProjects
        if selected.count == 1, let project = selected.first {
            ProjectDetailView(projectID: project.id)
        } else if selected.count > 1 {
            BulkDetailView(projects: selected)
        } else {
            OverviewView()
        }
    }
}

@MainActor
struct OverviewView: View {
    @EnvironmentObject private var model: StarterModel

    var body: some View {
        VStack(spacing: 16) {
            AppIconView(size: 80)
            Text("Select a project")
                .font(.title2.weight(.semibold))
            Text("Pick a project on the left to set it up or change its settings.\nHold ⌘ or ⇧ to select several.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            HStack(spacing: 12) {
                OverviewStat(value: model.count(status: .notSetUp), label: "Not set up", color: .secondary)
                OverviewStat(value: model.count(status: .updateAvailable), label: "Update available", color: .orange)
                OverviewStat(value: model.count(status: .ready), label: "Ready", color: .green)
            }
            .padding(.top, 6)
            if !model.gitAvailable {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                    Text("Git isn’t installed, so design skills can’t be downloaded.")
                    Button("Install Git") { model.installCommandLineTools() }
                }
                .padding(12)
                .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                .padding(.top, 8)
            }
        }
        .padding(32)
    }
}

@MainActor
struct OverviewStat: View {
    let value: Int
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.title.weight(.semibold))
                .foregroundStyle(value == 0 ? Color.secondary : color)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(width: 120)
        .padding(.vertical, 12)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.primary.opacity(0.06)))
    }
}
