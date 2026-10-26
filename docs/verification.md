# SpecScope acceptance results

Verified on **26 October 2026** against the production static export, using fictional data. This is a self-initiated ConsoleLog Studio portfolio project. The local release is implemented and verified; public Cloudflare deployment and its HTTPS smoke checks are pending Pages authorization.

## Recorded results

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | Pass | `npm run typecheck` |
| ESLint | Pass | `npm run lint` |
| Formatting | Pass | `npm run format:check` |
| Domain and persistence | **70 passed** | `npm test`; [unit results](evidence/unit-results.json) |
| Static production export | Pass | `npm run build` with webpack; fixed HTML routes in `out/` |
| Browser acceptance | **93 passed, 2 skipped, 0 failed, 0 flaky** | `npm run test:e2e`; [complete browser results](evidence/browser-results.json) |
| Calculation responsiveness | **10.6 ms maximum**, 10.4 ms p95, 5.8 ms median; 200 ms target | `npm run benchmark`; [raw measurements](evidence/performance.json) |
| Screenshots and walkthrough | Pass; **32.48 seconds** of video | `npm run capture:portfolio`; [capture environment](evidence/capture-environment.json), [walkthrough](evidence/specscope-walkthrough.webm) |
| A4 / Letter and long print | Pass | [print assertions](evidence/print-results.json); all seven rendered pages visually inspected |
| Public deployment | **Pending** | Saved Cloudflare login lacks `pages:write`; see [deployment instructions](deployment.md) |

The browser suite has 19 scenarios across five browser projects, with one worker and no retries. Clipboard read-back alone is skipped in Firefox and WebKit because those engines do not expose the same automation permission. The real clipboard is tested in Chromium, Chrome, and Edge. All other scenarios run in every configured browser.

## Environments

| Environment | Version / details |
| --- | --- |
| OS | Windows, build 10.0.26200, x64 |
| CPU | 13th Gen Intel Core i7-1355U; 12 logical CPUs |
| Memory | 16 GiB |
| Node / npm | 24.14.0 / 11.14.1 |
| Playwright | 1.64.1 |
| Bundled Chromium | 156.0.8078.4 |
| Bundled Firefox | 157.0 |
| Bundled WebKit | 27.2 |
| Installed Google Chrome | 156.0.8078.47 |
| Installed Microsoft Edge | 156.0.4314.42 |
| Viewports | 1440 × 1000 desktop; 360 × 800 phone |

[Browser version evidence](evidence/browser-versions.json). The Browser plugin was unavailable, so browser QA used the installed Playwright API. WebKit was exercised on Windows; the actual Safari application and physical iPhones were not available.

## Product acceptance

| ID | Result | Verified behavior |
| --- | --- | --- |
| **P06-A1** | Pass | New requests default to Needs clarification. The user chooses classification and saves the reason. Both persist and appear in the quote. Domain tests and browser classification/guard scenarios. |
| **P06-A2** | Pass | 60.00/hour × 20 estimated minutes becomes 30 billable minutes and 30.00. Tests cover 15-minute boundaries, fractional-minor-unit ties upward, maximum estimates, invalid amounts, USD/BDT, and zero within-scope fees. |
| **P06-A3** | Pass | Clarification, missing additional estimates, and missing reasons block publication. Field errors and dialog focus are exercised in real browsers. |
| **P06-A4** | Pass | Published snapshots freeze identifying details, scope, deliverable text, request, reasoning, response, original estimate, rate, and fee. Later project/scope edits do not rewrite them. Revision creates a linked draft with its original scope selection. |
| **P06-A5** | Pass | Acceptance requires a reference and a valid calendar date. Publication/decision writes are atomic. Duplicate and concurrent actions create one event; terminal records cannot reopen or be edited in place. Rejection and deferral are exercised. |
| **P06-A6** | Pass with noted clipboard coverage | Templates use saved supplied facts, edited text survives reload, and replacement asks for confirmation. Network inspection covers entering requests, generating responses, importing a named backup, and copying. Copy read-back is verified in three Chromium-based browsers. |
| **P06-A7** | Pass | Complete backups preserve snapshots and events. A4 and Letter show exact zero-fee accepted quotes and “Approval recorded manually.” A three-page maximum-text draft shows the exact 210.00 fee. Text/bounds assertions and rendered-page review complement browser print-emulation checks. |

## Shared acceptance

| ID | Result | Verified behavior |
| --- | --- | --- |
| **G-A1** | Pass within tested environments | Main screens fit 360 px and 1440 px; data tables have deliberate scroll regions. Keyboard navigation, visible focus, skip link, accessible validation, dialog focus/restore, and reduced-motion styles are covered. Automated axe WCAG A/AA checks pass on core screens and approval dialog; this is not a formal accessibility certification. |
| **G-A2** | Pass | Loading, empty, saved, invalid, stale, storage-blocked, and failed-write states are distinct. Injected write failures preserve pending text and committed data without showing Saved. Recovery copy/export and unsaved navigation protection are exercised. |
| **G-A3** | Pass | Reload persistence, exact backup round trips, invalid and corrupted imports, broken references, two actual browser tabs, transaction aborts, duplicate actions, and monotonic replacement revisions. A corrupt existing record cannot be overwritten by fallback state. |
| **G-A4** | Pass for inspected actions | User text, response text, backup contents, and filenames are not transmitted in the inspected workflows. No mutation network requests or third-party content requests occur. Fonts/assets are local. Loaded in-app navigation, saving, and quoting work with browser networking disabled. |
| **G-A5** | Pass | Array-count preflight checks precede deep import validation. Entity limits and the complete UTF-8 backup cap are enforced. The exact 10 MiB boundary succeeds; one additional byte fails without replacing prior state. Oversized edits remain pending. |
| **G-A6** | Pass | Actual commands, versions, reference hardware, raw browser/performance evidence, screenshots, print examples, and walkthrough are included. Deployment and unsupported environments are explicitly distinguished. |

## Reliability and isolation evidence

Domain and fake-indexeddb tests cover the complete workspace invariant checks, including unknown versions/apps/fields, duplicate identifiers, invalid calendar dates, missing references, inconsistent quote calculations, lifecycle history, and revision cycles. Persistence tests verify revision conflicts and atomic quote/event writes.

Real-browser scenarios cover a complete BDT personal project → scope → request → response → published quote → manual acceptance → reload journey, plus edits to the sample workspace. Importing or resetting the sample database leaves personal records intact. Storage quota and unavailable-startup failures are injected into the browser's IndexedDB API; the test does not fill the host disk.

## Performance measurement

The imported synthetic fixture contains **50 projects, 1,000 requests, 20 scope revisions per project, and 50 deliverables per revision**: 50,000 deliverables in an 8,084,971-byte backup. Twenty estimate edits measure input-event time to the next animation frame containing the correct fee. All twenty calculations are checked for correctness before recording the timing result.

This measures live calculation responsiveness on the documented laptop. It does not measure cold loading, full-workspace validation/save duration, phone hardware, or a service-level guarantee. No validation or size limit was weakened to reach the target.

## Print and portfolio artifacts

- [A4 accepted change order](evidence/change-order-a4.pdf): two pages, zero additional fee, external approval reference/date.
- [Letter accepted change order](evidence/change-order-letter.pdf): two pages with the same frozen evidence.
- [Long A4 draft](evidence/change-order-long-a4.pdf): three pages with 5,000-character request, 1,000-character reasoning, and 5,000-character response.
- [Desktop comparison](evidence/comparison-desktop.png), [complete comparison](evidence/comparison-full.png), and [phone comparison](evidence/comparison-mobile.png).
- [Projects](evidence/projects-desktop.png), [phone projects](evidence/projects-mobile.png), [scope history](evidence/scope-history-desktop.png), [published quote](evidence/quote-desktop.png), and [decision log](evidence/decision-log-desktop.png).
- [32.48-second walkthrough](evidence/specscope-walkthrough.webm), [case-study draft](case-study.md), and [three LinkedIn drafts](linkedin-drafts.md).
- [Deployable static ZIP](evidence/specscope-static.zip) and [release file/hash record](evidence/release.json).

The PDFs were rendered with Poppler and inspected page by page. pypdf and pdfplumber checks confirm expected fee/approval wording and no out-of-page text characters. Browser print dialogs and physical printers differ; the app uses the user's browser print dialog.

## Remaining release limits

- Public Cloudflare HTTPS routing, headers, and deployed smoke checks await an account with Pages write permission. No public URL or live deployment success is claimed.
- Actual Safari, physical phones, assistive-technology sessions, and physical printing were not tested. Viewport simulation and WebKit are the available evidence.
- Native clipboard read-back in Firefox/WebKit was not tested. Manual copy remains available if the browser blocks clipboard access.
- Browser storage may be cleared or evicted. Backups are essential. There is no cross-device sync, service worker, or guaranteed cold offline reload.
- No production users, client outcomes, or time savings have been measured. Portfolio examples and approvals are fictional.
