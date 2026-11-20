import AppKit
import Security
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

@main
struct ClaudeStarterApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = StarterModel()

    var body: some Scene {
        WindowGroup(AppInfo.name) {
            RootView()
                .environmentObject(model)
                .frame(minWidth: 900, minHeight: 600)
        }
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandGroup(after: .appInfo) {
                Button("Check for Updates…") {
                    Task { await model.checkForUpdates(userInitiated: true) }
                }
            }
        }
        Settings {
            SettingsView()
                .environmentObject(model)
        }
    }
}

@MainActor
struct RootView: View {
    @EnvironmentObject private var model: StarterModel

    var body: some View {
        Group {
            if !model.hasLoaded {
                ProgressView("Getting ready…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if !model.isReadyToUse {
                SetupView()
            } else {
                MainView()
            }
        }
        .task { await model.start() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            guard model.hasLoaded, !model.isBusy, !model.isInstallingNode else { return }
            if !model.canFinishSetup || !model.gitAvailable || !model.claudeCodeAvailable {
                Task { await model.start() }
            }
            Task { await model.checkForUpdatesIfDue() }
            Task { await model.refreshRulesHash() }
        }
        .onReceive(Timer.publish(every: 1800, on: .main, in: .common).autoconnect()) { _ in
            guard model.hasLoaded, !model.isUpdating else { return }
            Task { await model.checkForUpdates(userInitiated: false) }
        }
        .sheet(isPresented: $model.showingActivity) {
            ActivityView()
                .environmentObject(model)
        }
        .sheet(isPresented: $model.showingUpdate) {
            UpdateSheet()
                .environmentObject(model)
        }
    }
}

@MainActor
struct AppIconView: View {
    let size: CGFloat

    var body: some View {
        Image(nsImage: NSImage(named: NSImage.applicationIconName) ?? NSImage())
            .resizable()
            .interpolation(.high)
            .frame(width: size, height: size)
    }
}
