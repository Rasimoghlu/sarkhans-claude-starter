import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const hasFile = (dir, ...names) => names.some((name) => existsSync(join(dir, name)));
const hasExtension = (dir, ...extensions) => {
  try {
    return readdirSync(dir).some((name) => extensions.some((extension) => name.endsWith(extension)));
  } catch {
    return false;
  }
};
const readSafe = (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
};
const wrapper = (dir, name, fallback) => (existsSync(join(dir, name)) ? join(dir, name) : fallback);
const step = (name, tool, args, { slow = false, requires = null } = {}) => ({ name, tool, args, slow, requires });

const OTHER_STACKS = [
  {
    id: "rust",
    label: "Rust (cargo)",
    detect: (dir) => hasFile(dir, "Cargo.toml"),
    commands: () => [
      step("build", "cargo", ["build"]),
      step("clippy", "cargo", ["clippy", "--", "-D", "warnings"], { requires: "cargo-clippy" }),
      step("test", "cargo", ["test"], { slow: true }),
    ],
  },
  {
    id: "java",
    label: "Java/Kotlin (Maven)",
    detect: (dir) => hasFile(dir, "pom.xml"),
    commands: (dir) => [step("verify", wrapper(dir, "mvnw", "mvn"), ["-q", "-B", "verify"], { slow: true })],
  },
  {
    id: "java",
    label: "Java/Kotlin (Gradle)",
    detect: (dir) => hasFile(dir, "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"),
    commands: (dir) => [step("build", wrapper(dir, "gradlew", "gradle"), ["build"], { slow: true })],
  },
  {
    id: "dotnet",
    label: ".NET",
    detect: (dir) => hasExtension(dir, ".sln", ".csproj", ".fsproj"),
    commands: () => [step("build", "dotnet", ["build"]), step("test", "dotnet", ["test"], { slow: true })],
  },
  {
    id: "ruby",
    label: "Ruby",
    detect: (dir) => hasFile(dir, "Gemfile"),
    commands: (dir) => [
      ...(hasFile(dir, ".rubocop.yml") ? [step("rubocop", "bundle", ["exec", "rubocop"])] : []),
      ...(hasFile(dir, "spec") ? [step("rspec", "bundle", ["exec", "rspec"], { slow: true })]
        : hasFile(dir, "test") ? [step("test", "bundle", ["exec", "rake", "test"], { slow: true })] : []),
    ],
  },
  {
    id: "dart",
    label: "Dart/Flutter",
    detect: (dir) => hasFile(dir, "pubspec.yaml"),
    commands: (dir) => {
      const tool = /^\s*flutter\s*:/m.test(readSafe(join(dir, "pubspec.yaml"))) ? "flutter" : "dart";
      return [step("analyze", tool, ["analyze"]), step("test", tool, ["test"], { slow: true })];
    },
  },
  {
    id: "swift",
    label: "Swift (SwiftPM)",
    detect: (dir) => hasFile(dir, "Package.swift"),
    commands: () => [step("build", "swift", ["build"]), step("test", "swift", ["test"], { slow: true })],
  },
  {
    id: "swift",
    label: "Swift (Xcode project)",
    detect: (dir) => !hasFile(dir, "Package.swift") && hasExtension(dir, ".xcodeproj", ".xcworkspace"),
    commands: () => [],
    skipReason: "Xcode project: build and test with `xcodebuild -scheme <scheme> test` (see swift.md)",
  },
];

export function detectOtherStacks(dir) {
  return OTHER_STACKS.filter((stack) => stack.detect(dir)).map((stack) => ({
    id: stack.id,
    label: stack.label,
    commands: stack.commands(dir),
    skipReason: stack.skipReason || null,
  }));
}

export function isStaticSite(dir) {
  return hasFile(dir, "index.html");
}

export function commandText(command) {
  const tool = command.tool.split(/[\\/]/).pop();
  return `\`${[tool === "mvnw" || tool === "gradlew" ? `./${tool}` : tool, ...command.args].join(" ")}\``;
}
