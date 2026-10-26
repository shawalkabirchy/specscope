# Cloudflare Pages deployment

SpecScope is a fully static Next.js export. It requires no Functions, Workers runtime, database, API keys, or environment secrets.

## Live deployment

- Application: https://specscope.pages.dev/
- Source: https://github.com/shawalkabirchy/specscope
- Cloudflare Pages project: `specscope`
- Production branch: `main`; automatic deployment is enabled in settings, but its push trigger is not verified.
- Build command: `npm run build`; output directory: `out`; repository root.
- Build environment: `NODE_VERSION=24.14.0`, `NPM_VERSION=11.14.1`, `NEXT_TELEMETRY_DISABLED=1`.
- Preview deployments and automatic pull-request comments are disabled. Web analytics is not configured.

The initial production build and asset publication succeeded on 26 October 2026 through the connected Cloudflare account. [Acceptance results](verification.md) record live browser and HTTP checks.

No new build appeared after the follow-up documentation push, despite the enabled automatic-deployment setting. The latest release is therefore published by explicitly creating a Pages deployment from the current `main` branch. Future source changes should also be explicitly deployed until the GitHub integration's push trigger is verified. No GitHub App was uninstalled or granted broader access to work around this behavior.

## Build

Use Node 24.14.0 and npm 11.14.1:

    npm ci
    npm run typecheck
    npm run lint
    npm test
    npm run build
    npm run test:e2e

The deployment directory is **out**. Do not deploy .next or use next start.

## Git-connected Pages

The source repository is connected to Cloudflare Pages. Push changes with `git push origin main`, then verify that a deployment for that exact commit starts. If it does not, explicitly create a Pages deployment for branch `main` through the connected Cloudflare account or repair the repository's Git integration in the dashboard. Cloudflare installs the locked dependencies, runs **npm run build**, and publishes **out**. Keep the existing _headers file, including its security and static-asset cache headers.

The app includes a real 404 page and fixed HTML routes. Do not add a blanket SPA rewrite: every application route has an exported HTML document.

## Direct upload alternative

For a separately created Direct Upload project, use an account authorized for Pages:

    npx wrangler whoami
    npx wrangler pages project list
    npx wrangler pages deploy out --project-name YOUR_DIRECT_UPLOAD_PROJECT --branch main

Replace the project placeholder with that project's actual name. The live `specscope` project already exists and uses Git integration; do not create it again.

The connected Cloudflare account completed deployment. A separate CLI login still needs Pages write permission before using Wrangler; no credential is stored in this repository.

For a separate dashboard Direct Upload project, use the prepared [specscope-static.zip](evidence/specscope-static.zip). It contains the local reference export at the archive root, including `index.html` and `_headers`. Dashboard upload accepts a ZIP or folder; Wrangler accepts the `out` folder. The Git-integrated live project does not support dashboard drag-and-drop replacement. Use its Git build workflow instead.

The package's file count, byte sizes, and SHA-256 are recorded in [release.json](evidence/release.json). Rebuild and repackage after changing application code; do not deploy a stale archive.

## Release smoke checks

On the returned HTTPS URL, check Projects, Requests, Scope history, Comparison, Quote, Decision log, and Settings. Reload a direct record URL. Complete the sample dashboard request, publish its quote, record manual approval, and print it. Verify both workspace modes, backup/download/import, console health, local fonts, and security headers.

Keep sample data fictional. Personal records remain on the visitor’s device; the static deployment does not contain anyone’s private browser database.

## Rollback and local records

Retain the previous successful static deployment and use the Pages dashboard’s rollback action if needed. Replacing site assets does not itself restore or delete IndexedDB.

Before changing persisted formats in a later release, add tested non-destructive migrations and verify backups from the previous release. Never clear an existing database on upgrade failure. Roll back only to code compatible with the database format already used by that browser.

Changing the hostname changes the browser’s storage origin. Tell users to export on the old origin and import on the new one.

## Cost boundary

Use Pages static hosting and a free provider subdomain. This app needs no dynamic Pages Functions or paid processing. Recheck provider limits before publishing. Do not enable a paid resource or buy a domain to complete deployment.

References:

- https://nextjs.org/docs/app/guides/static-exports
- https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
