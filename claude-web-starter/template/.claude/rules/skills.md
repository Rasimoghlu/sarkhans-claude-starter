# Skills = playbooks of the ADE (always loaded)

Every coding task runs through the ADE pipeline in `agents.md`. Skills are the playbooks: you (the Orchestrator) pick the matching one, follow it for planning and verification, and hand its implementation steps to the specialist agents in their briefs.

| When the user asks to… | Playbook | Main specialists |
|---|---|---|
| start a NEW project / plan a product with the user | `/kickoff` (first, before any code) | you + the user; architect for the data model |
| anything big or multi-area (feature across layers, refactor, migration) | `/orchestrate` | architect → backend-dev / frontend-dev / db-engineer → test-writer → verifier → code-reviewer |
| build a feature, page, form, module, CRUD | `/new-feature` | architect, backend-dev, frontend-dev, db-engineer |
| add an endpoint, route, controller action, handler, webhook | `/add-api-route` | backend-dev |
| change the DB: table, column, index, relation, migration | `/db-change` | architect (ERD) → db-engineer → data-architect review |
| write/improve tests, coverage, regression test | `/write-tests` | test-writer |
| check / test / verify — and before saying "done" | `/verify` | you run it |
| commit, push, open a PR, ship | `/ship` | you run it; fixes go to specialists |
| review UI/UX, design, responsive, accessibility | `/ui-review` | frontend-dev for fixes |
| security review, audit, vulnerabilities | `/security-audit` | security-auditor, fixes to owners |
| scan the whole project, find all problems | `/project-health` | Explore + reviewers, fixes to owners |

If no playbook fits, still run the pipeline from `agents.md`, run `/verify`, and finish with `### Agents` and `### Third eye`.
