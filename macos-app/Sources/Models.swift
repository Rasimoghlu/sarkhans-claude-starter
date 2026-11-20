import AppKit
import Security
import SwiftUI

struct Project: Identifiable, Hashable, Sendable {
    let path: String
    let name: String
    var installedVersion: String?
    var stacks: [String]
    var catalogInstalled: Set<String>
    var phase: String?
    var designMode: String?
    var kickoffDone: Bool
    var responseLanguage: String?
    var hasFrontend: Bool
    var usesReact: Bool
    var rulesHash: String?
    var preset: String?
    var orchestratorMode: String?
    var contextTokens: Int?

    var id: String { path }
    var workMode: String {
        if let preset, WorkMode(rawValue: preset) != nil { return preset }
        switch orchestratorMode {
        case "advisory": return WorkMode.lite.rawValue
        case "balanced": return WorkMode.standard.rawValue
        default: return WorkMode.strict.rawValue
        }
    }
    var isInstalled: Bool { installedVersion != nil }
    var isDesignLocked: Bool { (designMode ?? (phase == "new" ? "open" : "locked")) == "locked" }
}

enum WorkMode: String, CaseIterable, Identifiable {
    case lite, standard, strict

    var id: String { rawValue }

    var title: String {
        switch self {
        case .lite: return "Lite"
        case .standard: return "Standard"
        case .strict: return "Strict"
        }
    }

    var summary: String {
        switch self {
        case .lite:
            return "Claude edits code freely and uses agents only when they help. Safety checks and git rules stay on."
        case .standard:
            return "Claude makes small changes itself (up to 3 files per request) and hands bigger work to specialist agents with reviews."
        case .strict:
            return "Every change goes through the agent team: plan, build, independent review. Slowest and uses the most tokens."
        }
    }
}

struct CatalogItem: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let type: String
    let category: String
    let name: String
    let description: String
    let skill: String?
    let recommended: String?
    let path: String?
    let repo: String?

    var isMine: Bool { category == CatalogItem.mySkills }
    static let mySkills = "My skills"
}

struct BuiltinSkill: Identifiable, Hashable {
    let id: String
    let summary: String
}

struct SkillChoice: Decodable, Identifiable, Hashable {
    let name: String
    let description: String
    var id: String { name }
}

enum RegisterOutcome {
    case added(String)
    case choices([SkillChoice])
    case failed(String)
}

enum InstallState: Equatable, Sendable {
    case idle
    case running
    case succeeded
    case failed
}

struct CommandResult: Sendable {
    let status: Int32
    let output: String

    var succeeded: Bool { status == 0 }
}

enum ProjectFilter: String, CaseIterable, Identifiable {
    case needsSetup
    case ready
    case all

    var id: String { rawValue }

    var title: String {
        switch self {
        case .needsSetup: return "Needs setup"
        case .ready: return "Ready"
        case .all: return "All"
        }
    }
}

enum ProjectStatus {
    case notSetUp
    case updateAvailable
    case ready
}

enum DisplayStatus {
    case notSetUp
    case updateAvailable
    case ready
    case working
    case failed

    var title: String {
        switch self {
        case .notSetUp: return "Not set up"
        case .updateAvailable: return "Update available"
        case .ready: return "Ready"
        case .working: return "Working…"
        case .failed: return "Didn’t finish"
        }
    }

    var icon: String {
        switch self {
        case .notSetUp: return "circle.dashed"
        case .updateAvailable: return "arrow.up.circle.fill"
        case .ready: return "checkmark.circle.fill"
        case .working: return "hourglass"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }

    var color: Color {
        switch self {
        case .notSetUp: return .secondary
        case .updateAvailable: return .orange
        case .ready: return .green
        case .working: return .blue
        case .failed: return .red
        }
    }
}

struct Notice: Equatable {
    let id = UUID()
    let text: String
    let isError: Bool
}
