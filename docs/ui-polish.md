# UI/UX polish — 2026-10-17

Scope: shared frontend presentation and accessibility while Claude owns Riddle 4.
Do not change backend, API contracts, transfer logic or in-progress feature-page workflows.

## Findings addressed in the shared components

- Navigation depends on an oversized hover-driven menu; current location and primary actions are not obvious.
- The status footer wraps at phone widths and makes stronger AI-status claims than the health endpoint establishes.
- Decorative effects compete with the landing-page message; explanatory copy includes unsupported privacy/integration claims.
- Repeated field labels generate duplicate IDs; input/textarea hints and errors are not programmatically associated with their fields.
- Shared modals lack dialog semantics, a focus trap, focus restoration and a consistently named close control.
- Small controls/hints and low-contrast all-black surfaces weaken hierarchy and phone usability.
- Clipboard failures are silent and clicking a text field unexpectedly copies its contents.

## Change boundaries

Owner for this pass: shared `Layout`, `Brand`, `index.css`, shared UI primitives, `CopyField`, `ClassNav`, `Landing`, frontend entry/document metadata, and test-only browser checks. Re-read each before editing; preserve concurrent changes. Feature pages remain owned by the Riddle 4 work unless a specific presentational issue is safely isolated.

## Delivered

- Replaced the oversized navigation and animated landing decorations with a clear responsive header, teacher/student entry points, evidence-led copy and calmer layout.
- Added the [generated logo and favicon](brand.md), clearer surface/typography hierarchy, visible focus indicators and reduced-motion support.
- Made field IDs unique and associated hints/errors with inputs. Added tab keyboard controls, accessible dialog semantics, focus trapping/restoration, background inertness and clipboard feedback.
- Made projector access available on phones and fixed the question-editor heading/actions wrapping at narrow widths. This last change is presentation-only; no quiz or Riddle 4 behavior changed.

## Completed verification

- `npm run build`: TypeScript and Vite pass. Main JS is 587.40 kB (172.53 kB gzip), down from the pre-polish 672.08 kB. The >500 kB chunk warning remains.
- `npm run lint`: exits successfully with 24 existing hook/ref warnings in other components; no warnings in the changed shared components or landing page. This is not a zero-warning baseline.
- Offline backend suite on `98ca870` plus this UI work: **175 passed, 3 skipped** (17.25 s). Live-model opt-in and provider keys were unset; skipped live tests were not run.
- [Browser check](../backend/tests/browser_ui_polish.cjs): landing, create class, join, class overview, question builder, results and response detail at **1440 px and 360 px**. All 14 route/layout checks pass with no document-level horizontal overflow, duplicate IDs or browser runtime errors. Final screenshots were also inspected visually, including the mobile question-header fix.
- Keyboard skip link, mobile menu routing, teacher credential hash preservation, dialog focus containment, Escape, focus restoration and inert-background cleanup pass at both widths. Browser contexts request reduced motion.

The browser check uses the real production frontend with the isolated `tests.browser_riddle3_app` API, in-memory SQLite and a scripted model in `backend/tests/`. It does not use a real classroom database, hosted deployment or live AI.

## Reproduce and remaining boundaries

Build the frontend, start the isolated test server as described in [status](status.md#reproduce-the-targeted-browser-check), then run from the repository root:

```powershell
node backend/tests/browser_ui_polish.cjs <path-to-playwright-module> --verify
```

Set `BTM_BROWSER_PATH` if Chromium is not installed in Playwright's default location. Optional `BTM_UI_OUTPUT` saves screenshots to an existing folder. Stop the test server afterward; never deploy the fixture.

This is a targeted shared-UI audit, not a complete accessibility certification or an exhaustive Riddle 4 workflow review. Real clipboard permissions, screen-reader/browser combinations, failed network recovery, blocked storage, live model quality and hosted Postgres remain separate checks. Existing feature-page integration/privacy wording outside the landing page was not rewritten during Claude's feature work. No backend, API, transfer/recheck logic, dependencies or deployment configuration was changed by this pass.
