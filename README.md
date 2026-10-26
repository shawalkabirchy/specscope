# SpecScope

A clearer scope. A better conversation.

SpecScope helps freelancers and agencies compare a client request with agreed deliverables, record a human scope decision, estimate additional work, and prepare a change order. It is a **self-initiated ConsoleLog Studio portfolio project**, using fictional demo records.

[Open SpecScope](https://specscope.pages.dev/) · [Source repository](https://github.com/shawalkabirchy/specscope)

## Run locally

Use Node.js **24.14.0** and npm **11.14.1** (the reference environment).

    npm ci
    npm run dev

Open http://127.0.0.1:3000. To preview the actual static production build:

    npm run build
    npm run preview

Open http://127.0.0.1:4173. Set SPECSCOPE_PORT if that preview port is occupied. The preview server binds only to 127.0.0.1.

## What works

- Projects with USD or BDT hourly rates and versioned agreed deliverables.
- Request comparison, manual classification, explicit saves, and decision reasoning.
- Exact 15-minute estimate rounding and integer-money fee calculations.
- Three editable local response templates; copying never sends a message.
- Frozen quote documents, linked revisions, and manual acceptance/rejection/deferral.
- Print / Save PDF through the browser, with A4 and US Letter layouts.
- Complete validated JSON backups and confirmed atomic replacement.
- Separate editable sample and personal workspaces.
- Responsive layouts, keyboard controls, accessible confirmations, and recovery states.

There are no accounts, cloud sync, AI classification, email integrations, automatic sending, signatures, billing, or client portal.

## Data and backup

All product records live in IndexedDB. The default sample database is separate from the personal database. Use the workspace selector or **Start your workspace** to open a blank personal workspace.

**Settings & backups → Export workspace backup** downloads committed records. Import validates the complete file, shows record counts, offers an existing-data backup, and asks before replacing the selected workspace. Import never merges. The other workspace is untouched.

**Restore sample data** restores the fictional examples. **Reset personal workspace** removes personal records only after the same backup/confirmation flow.

The limits are 50 projects, 1,000 requests, 20 scope revisions per project, 50 deliverables per revision, and **10 MiB for a complete workspace backup**, whichever is reached first. A change exceeding the aggregate limit is rejected without overwriting committed records.

Save failures keep the pending form text in the open tab. Use **Copy unsaved text**, **Export recovery**, or **Reload latest** as appropriate. A stale-tab save cannot overwrite another tab’s commit. Copy unsaved text before discarding or reloading.

Browser storage is not a managed backup. Clearing site data, using private browsing, device loss, or browser eviction can remove it. Separate browsers, devices, and deployment origins have separate records. Export and import to move them.

The initial app load needs its static assets. Once loaded, calculations and saves run locally; in-app navigation uses the browser history API. A cold offline reload is not promised: this release does not install a service worker.

## Quote rules

The user chooses Within scope, Needs clarification, or Additional scope. Requests are not classified automatically.

Additional estimates round upward to 15 minutes. At 60.00/hour, 20 estimated minutes become 30 billable minutes and a 30.00 fee. The final fee rounds to the nearest minor unit, ties upward. Within-scope fees are zero; clarification cannot be quoted.

Unpublished drafts use the current project rate. A published quote freezes identifying details, scope references, request text, original estimate, billable minutes, rate, fee, reasoning, deliverables, and response. Terminal decisions cannot reopen in place; create a linked draft revision.

Acceptance records an external approval reference and real calendar date. SpecScope does not obtain a signature or present the document as legally binding.

## Stack and structure

- Next.js 16.4.3 App Router, React 19.3.1, TypeScript, static export.
- Tailwind CSS 4.3.3, official shadcn/ui base-nova source components, Lucide icons, locally bundled Geist.
- Zod schemas and idb-backed IndexedDB transactions.
- Vitest/fake-indexeddb and Playwright/axe.
- src/lib contains domain rules, schemas, validation, fixtures, and persistence.
- src/components contains the workspace shell and feature screens.
- src/app contains fixed exported routes. Locally created record IDs are query parameters.
- tests contains meaningful domain, persistence, browser, and boundary scenarios.
- docs contains design, verification, deployment, and portfolio material.

Webpack is explicitly selected because the reference Windows environment’s Turbopack CSS worker exited before connecting. No Next.js server or Cloudflare runtime adapter is required.

## Verify

    npm run typecheck
    npm run lint
    npm test
    npm run build
    npx playwright install chromium firefox webkit
    npm run test:e2e

The full browser configuration also checks installed Chrome and Edge channels. If those applications are unavailable, select the bundled engines:

    npm run test:e2e -- --project=chromium --project=firefox --project=webkit

Browser tests use the exported out directory, not the development server. See docs/verification.md for actual results, environments, acceptance mappings, and remaining limits. WebKit automation does not certify the actual Safari application.

    npm run capture:portfolio

This captures synthetic-data screenshots and a short walkthrough from the production preview. It never resets the workspace in your own browser profile.

With `npm run preview` running in another terminal:

    npm run benchmark

This measures live fee calculation against the maximum supported record counts and records its environment and raw samples. The reference result is 10.6 ms maximum across 20 updates; it does not measure full-workspace save time or phone hardware.

## Deployment and portfolio

The public app runs on Cloudflare Pages at https://specscope.pages.dev/. The GitHub repository's `main` branch deploys automatically using `npm run build` and the `out` directory. See docs/deployment.md for the recorded settings, verification, and rollback procedure.

The prepared `docs/evidence/specscope-static.zip` contains the local reference export for Direct Upload to a separate Pages project. The live project builds from GitHub; dashboard drag-and-drop replacement is unavailable for Git-integrated projects.

See docs/case-study.md and docs/linkedin-drafts.md for the portfolio package. Drafts are not posted automatically. No customer outcomes, savings, or commercial traction are claimed.

## Troubleshooting

- **Storage unavailable/full:** keep the tab open and export recovery data. Do not clear the database to fix a migration or storage error.
- **Workspace changed in another tab:** copy unsaved text, then reload the latest state.
- **Invalid backup:** check it is a complete P06 formatVersion 1 file under 10 MiB. A failed import leaves existing records intact.
- **Clipboard blocked:** select and copy the response text manually.
- **Different data after deployment:** each origin has independent IndexedDB; restore a downloaded backup on the new origin.
- **Missing browser engines:** run the Playwright install command above.
- **Preview port occupied:** stop the previous preview or select another SPECSCOPE_PORT.

Required third-party licenses and attribution are collected in THIRD_PARTY_NOTICES.md. The original project brief remains in files/consolelog-project-build-briefs.md.
