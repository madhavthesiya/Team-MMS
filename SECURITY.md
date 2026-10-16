# Security and student data

BehindTheMark is a classroom prototype. These are its current boundaries and known limitations, not a claim of a security audit or regulatory compliance.

## Access boundaries

- Creating a class returns a secret teacher token. It grants access to that class's quiz, student work, results, overrides, and deletion. Treat the teacher link as a credential.
- A student join code admits a new nickname-based student; it does not grant teacher access. A student token scopes answer submission and follow-up replies to that student.
- The server stores SHA-256 token hashes and compares teacher hashes using `hmac.compare_digest`. Do not log or export raw tokens or token-bearing links.
- Every new teacher/student endpoint must enforce ownership server-side. Hiding a UI control does not authorize a request.
- Public mutations are limited per IP; student submissions/replies are limited per token. These limits are in memory and apply to one process, not a distributed deployment.

## Data and AI

Use synthetic data for development, tests, screenshots, and public demonstrations. Student-facing copy should request nicknames and explain the use of AI before submission.

The current pipeline redacts recognizable email addresses and phone numbers from explanations and follow-up replies before storing/sending those fields. This is a regex heuristic, not comprehensive anonymization. Raw answer strings are currently passed to prompts without the same redaction, and teacher-entered question text is also sent to Gemini. Do not claim that all personal information is removed. Field-wide PII handling is a known gap.

Gemini receives question context and student work for analysis. Prompt delimiters, output schemas, quote checks, restricted labels, and uncertainty handling reduce risk but do not prove immunity to prompt injection or incorrect interpretations.

AI output must not change answer correctness, execute actions, or reach students as a diagnosis. Teacher overrides remain authoritative, including against an AI re-read that finishes later (verified on SQLite; hosted Postgres not yet checked — see [docs/status.md](docs/status.md)).

## Persistence and deployment

Class deletion removes associated quiz, student, response, and diagnosis records through the current database relationships. This does not claim deletion from provider retention, external logs, exports, or database backups.

Before wider use with real student data, define retention, access recovery/revocation, appropriate consent, secure hosting, backup handling, and the applicable institutional requirements. Current tokens have no documented expiry/recovery flow. Schema upgrades are additive only (`backend/app/migrations.py`); there is no rollback workflow.

Keep `.env`, database files, keys, virtual environments, and private exports out of Git and container build contexts. Put runtime secrets in local environment configuration or the deployment secret store. Use placeholders without real credentials in examples. If a real secret leaks, revoke/rotate it and coordinate remediation; a later deletion commit does not remove it from Git history.

## Reporting

Report sensitive issues privately to the repository maintainers through an available private channel. This repository does not yet publish a dedicated disclosure contact. Public reports should contain only a redacted reproduction using synthetic data. Do not include tokens, keys, private student content, or active teacher links.
