# Changelog

Each section becomes the release notes that people see in the app and on the Releases page. Write them for users.

## 4.5.5
- Every folder in your projects folder is listed now, not only Node, PHP, Go and Python projects.
- Recognised in addition: Rust, Java/Kotlin (Maven, Gradle), .NET, Ruby, Dart/Flutter, Swift, Docker and static sites. Anything else is shown as "Other" and still gets the full rules.
- `/verify` runs the build and tests of these languages too (cargo, Maven/Gradle, dotnet, rspec, flutter/dart, swift) when the tool is installed.
- The comment rule and the code-quality rules now also cover Rust, Java, Kotlin, C#, Swift, Dart, Ruby, Scala, C/C++ and shell scripts.

## 4.5.4
- The app now checks for new versions every 30 minutes and whenever you switch back to it, not only when it opens. A badge on the Dock icon shows that an update is waiting.
- When an update brings new rules, your set-up projects get them automatically right after the app restarts. There's no second "Update" per project.
- Projects show "Update available" only when the rules really changed, not on every app update.
- You can turn automatic rule updates off in Settings → Projects.

## 4.5.3
- After an update, the app confirms it with "Updated to …" when it opens again.

## 4.5.2
- Fixed: "Update and restart" could stay on "Updating…" forever.
- The update window shows what it's doing: downloading, checking, restarting.
- Tidier built-in skills list.

## 4.5.1
- Updates work when the app is in a folder that needs admin rights: macOS asks for your password once.
- Downloads and updates come from this repository's Releases page.

## 4.5.0
- First release of Sarkhans Claude Starter.
