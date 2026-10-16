# Contributing and agent handoffs

Read [AGENTS.md](AGENTS.md) first. This workflow applies to people and coding agents using the same checkout or repository.

## Pick a bounded task

Use [docs/status.md](docs/status.md) for the verified baseline and open issues, and the plans in `docs/superpowers/plans/` for planned work. Each task should state its outcome, files it is likely to touch, dependencies, and acceptance criteria. A plan entry is not a task assignment.

Before editing, inspect `git status --short` and the current branch. Identify overlapping work with the person coordinating the project. A directory with uncommitted code may already belong to another worker. When concurrent work is needed, agree on separate files or branches/worktrees before making conflicting changes; preserve existing changes.

## Interface changes

For API changes, update `docs/api-contract.md`, `backend/app/schemas.py`, route/service behavior, and API tests together. Include affected frontend types and recovery behavior. Bump the contract version for a changed public shape or behavior and describe compatibility impact.

Keep the design spec as product intent, architecture as the implementation map, status as a dated verification record, and the plans as work still to do. Do not copy endpoint examples into several new documents where they can drift.

## Verification

- Backend: run focused regression tests and the offline suite using the README commands. Keep test data synthetic and model doubles in `backend/tests/`.
- Persistence/concurrency: test the relevant interleaving and transaction behavior. A passing in-memory SQLite test is not evidence of Postgres concurrency safety.
- AI: preserve prompt version metadata. Run live tests only when model verification is in scope and credentials are configured locally. Report skipped checks honestly.
- Frontend: build using its actual package scripts and check 360 px layout, loading/error/empty states, student refresh recovery, and blocked-storage behavior.
- Docs: validate relative links, file paths, configuration names, commands, and the distinction between existing and planned work. Do not publish invented results, URLs, screenshots, or completion claims.

Before handing off, run `git diff --check` and inspect the task diff. Stage only named task files when a commit is requested. Public pushes, deployments, and release tags need authorization for the destination and action; do not infer it from a code review request.

## Handoff template

Use this in the task/chat or a pull request. It is a template, not a claim that work has been assigned or completed.

```text
Task and owner:
Base branch/commit:
Outcome and acceptance criteria:
Files changed / interfaces changed:
Validation commands and results:
Checks skipped and why:
Known issues or assumptions:
Next action and dependencies:
Commit or review reference, if created:
```

Update the relevant status row only after verifying the change. Include the date, commit or file evidence, and exact checks run. Keep credentials, tokens, private student work, and local filesystem details out of shared handoffs.

## Completion criteria

A change is ready to hand off when it meets the agreed acceptance criteria, preserves the product invariants, has proportionate verification, and has matching docs for any changed behavior. Passing unit tests alone does not establish that the full product is deployed or classroom-ready.
