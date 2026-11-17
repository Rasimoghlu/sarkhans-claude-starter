---
name: kickoff
description: Kickoff for a NEW project — discuss the product with the user before any code (goal, users, features, platforms, look & feel, constraints), agree scope and design direction, pick and install the fitting frontend/design skill, and record decisions in .claude/KICKOFF.md. Use first in every new project and whenever the user wants to plan a new product.
argument-hint: "[short idea of the project]"
---
# Project kickoff (new project — no code yet)

Idea: $ARGUMENTS

You are the Orchestrator. This is a conversation with the user, not a build. Ask in the project's response language, a few questions at a time, and summarize what you understood after each round.

## 1. Product
- What problem does it solve, for whom? What does success look like?
- The 3–7 core features of the first version (MVP); what is explicitly out of scope.
- Users and roles; authentication needs; languages; devices (web, mobile web, desktop-first?).

## 2. Look & feel
- Brand: name, logo, existing colors/fonts? Reference sites/apps they like (and dislike)?
- Mood in 3 words (e.g. calm/professional/minimal, bold/playful/energetic).
- Light/dark mode, density (compact data-heavy vs airy), accessibility requirements.

## 3. Technical constraints
- Stack in this repo (from CLAUDE.md) and anything fixed (hosting, database, integrations, Docker).
- Data the app must store (rough entities) — `architect`/`data-architect` will refine it.

## 4. Proposal (you write it, the user decides)
- Scope summary and a phased plan (MVP → next).
- **Design direction:** 2–3 short options (palette, typography, layout style, component library) with your recommendation.
- **Design skill:** pick from `.claude/rules/design-policy.md` based on the project type and explain why in one or two sentences. Recommend `playwright` MCP too if UI matters.
- Rough data model (entities + relations) and main screens.

Ask for confirmation or changes. Iterate until the user agrees.

## 5. After agreement
1. Install the chosen skill(s): `node ~/claude-web-starter/install.mjs . --add-skill <id>` (and `--add-skill playwright` if agreed). Tell the user to restart Claude Code if a new MCP must be approved.
2. Write `.claude/KICKOFF.md` with: product summary, MVP scope, out of scope, users/roles, design direction (palette, typography, spacing, component library, references, mood), chosen design skill(s), data model sketch, main screens, phased plan, open questions. (This file unlocks code edits — a hook checks it.)
3. If the design skill expects its own brief (e.g. `DESIGN.md`/`PRODUCT.md`), create it from the same decisions.
4. Propose the first task (usually the app shell + design tokens + one core screen) and start it with `/orchestrate` when the user says go.

End with a short summary and `### Third eye` (risks, open questions).
