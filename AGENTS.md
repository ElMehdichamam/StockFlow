# StockFlow — AI Agent Instructions

## 1. Project Context

StockFlow is an Inventory & Order Management application.

Before starting any task, read `StockFlow_Project_Brief.md` and follow its requirements.

If `docs/api-contract.md` exists, read it before implementing or integrating API-related features.

## 2. Agent Responsibilities

### Antigravity — Frontend
- Work primarily inside `frontend/`.
- Build the React UI using the agreed frontend stack.
- Use mock data when backend endpoints are not yet available.
- Follow the agreed API contract when integrating with the backend.
- Do not modify backend implementation files unless explicitly authorized.

### OpenCode — Backend
- Work primarily inside `backend/`.
- Implement backend functionality using the agreed backend stack.
- Follow the agreed API contract.
- Do not modify frontend implementation files unless explicitly authorized.

### Project Owner
- The project owner makes final decisions about requirements, architecture, data models, API contracts, and major dependencies.
- Agents may suggest improvements but must not silently turn suggestions into approved requirements.

## 3. Rules for All Agents

1. Inspect the existing project structure before making changes.
2. Read relevant documentation before starting a task.
3. Do not assume an undecided requirement has already been approved.
4. If an important decision is missing, ask the project owner or propose options before implementing it.
5. Keep changes focused on the assigned task.
6. Do not overwrite or refactor unrelated work.
7. Do not edit files owned by the other agent without explicit permission.
8. Do not install new dependencies without explaining why they are needed.
9. Never expose secrets, tokens, passwords, or `.env` contents.
10. Never run destructive database commands, push changes, or deploy without explicit approval.
11. Do not claim that code was tested unless the relevant tests or checks were actually run.
12. Explain important changes and identify any remaining issues when finishing a task.

## 4. Undecided Requirements

If the project brief marks something as undecided, keep it undecided until the project owner approves a decision.

Do not independently finalize:
- Database schemas and relationships
- API endpoints and request/response formats
- Order status transitions and inventory deduction rules
- Revenue and dashboard metric calculations
- Authentication and JWT lifecycle details
- Additional libraries or major architectural choices

Update shared documentation when a decision is approved. Do not silently change an agreed decision.

## 5. Collaboration and Integration

- Frontend and backend work happen in separate directories.
- Coordinate through shared documentation, especially `docs/api-contract.md`.
- Do not assume an endpoint exists just because the frontend needs it.
- Do not change the API contract unilaterally.
- Before integration, identify mismatches between frontend expectations and backend behavior.
- Avoid editing the same files concurrently.

## 6. Git and Verification

Before editing, inspect the current Git status and preserve existing user changes.

After editing:
- Summarize the files changed.
- Explain the behavior implemented.
- Report checks or tests actually performed.
- List unresolved questions, assumptions, and blockers.

Do not create commits unless explicitly requested.

## 7. Task Scope

Work only on the task explicitly assigned.

Before making broad changes, deleting files, restructuring directories, or introducing a major dependency, explain the proposed change and obtain approval.

If a task conflicts with this file or the project brief, stop and explain the conflict rather than guessing.
