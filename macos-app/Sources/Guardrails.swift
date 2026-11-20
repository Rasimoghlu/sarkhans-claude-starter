import Foundation

struct GuardrailSummary: Hashable, Sendable {
    var weekCounts: [String: Int]
    var weekTotal: Int
    var allTimeTotal: Int
    var firstEvent: Date?

    static let logPath = "/.claude/logs/guardrails.jsonl"
    private static let week: TimeInterval = 7 * 24 * 60 * 60

    static func load(projectPath: String, now: Date = Date()) -> GuardrailSummary? {
        guard let text = try? String(contentsOfFile: projectPath + logPath, encoding: .utf8) else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var summary = GuardrailSummary(weekCounts: [:], weekTotal: 0, allTimeTotal: 0, firstEvent: nil)
        for line in text.split(separator: "\n") {
            guard let data = line.data(using: .utf8),
                  let entry = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                  let category = entry["category"] as? String,
                  let time = (entry["time"] as? String).flatMap(parser.date(from:)) else { continue }
            summary.allTimeTotal += 1
            if summary.firstEvent.map({ time < $0 }) ?? true { summary.firstEvent = time }
            if now.timeIntervalSince(time) <= week {
                summary.weekTotal += 1
                summary.weekCounts[category, default: 0] += 1
            }
        }
        return summary
    }

    var weekRows: [GuardrailRow] {
        var merged: [GuardrailCategory: Int] = [:]
        for (key, count) in weekCounts {
            merged[GuardrailCategory(rawValue: key) ?? .other, default: 0] += count
        }
        return merged
            .map { GuardrailRow(category: $0.key, count: $0.value) }
            .sorted { $0.count == $1.count ? $0.category.title < $1.category.title : $0.count > $1.count }
    }
}

struct GuardrailRow: Identifiable {
    let category: GuardrailCategory
    let count: Int

    var id: String { category.rawValue }
}

enum GuardrailCategory: String {
    case secrets, git, invented, dependencies, comments, types, errors, debug, security, database
    case design, workmode, evidence, report, build, commands, protected, other

    var title: String {
        switch self {
        case .secrets: return "Secrets kept out of code and git"
        case .git: return "Git rules (main branch, force-push, AI mentions)"
        case .invented: return "Invented packages, imports or files"
        case .dependencies: return "Unapproved dependencies"
        case .comments: return "Comments in code"
        case .types: return "Type-system escapes"
        case .errors: return "Swallowed errors"
        case .debug: return "Leftover debug output"
        case .security: return "Security risks (SQL, XSS, eval, TLS, pentest scope)"
        case .database: return "Database design problems"
        case .design: return "Unrequested design changes"
        case .workmode: return "Work-mode limits"
        case .evidence: return "Agent reports without evidence"
        case .report: return "Missing final report or review"
        case .build: return "Type or build errors at the finish"
        case .commands: return "Dangerous commands"
        case .protected: return "Protected files"
        case .other: return "Other rules"
        }
    }

    var symbol: String {
        switch self {
        case .secrets: return "key.fill"
        case .git: return "arrow.triangle.branch"
        case .invented: return "questionmark.diamond.fill"
        case .dependencies: return "shippingbox.fill"
        case .comments: return "text.bubble.fill"
        case .types: return "curlybraces"
        case .errors: return "exclamationmark.octagon.fill"
        case .debug: return "ladybug.fill"
        case .security: return "lock.shield.fill"
        case .database: return "cylinder.split.1x2.fill"
        case .design: return "paintpalette.fill"
        case .workmode: return "person.3.fill"
        case .evidence: return "checkmark.seal.fill"
        case .report: return "doc.text.fill"
        case .build: return "hammer.fill"
        case .commands: return "terminal.fill"
        case .protected: return "lock.doc.fill"
        case .other: return "shield.fill"
        }
    }
}
