# Cloudflare Pages deployment

SpecScope is a fully static Next.js export. It requires no Functions, Workers runtime, database, API keys, or environment secrets.

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

Connect the source repository in Cloudflare Pages. Choose a static Next.js export, set the build command to **npm run build**, and the output directory to **out**. Use the actual production branch of the repository. Keep the existing _headers file, including its security and static-asset cache headers.

The app includes a real 404 page and fixed HTML routes. Do not add a blanket SPA rewrite: every application route has an exported HTML document.

## Direct upload

With an account authorized for Pages:

    npx wrangler whoami
    npx wrangler pages project list
    npx wrangler pages project create consolelog-specscope --production-branch main
    npx wrangler pages deploy out --project-name consolelog-specscope --branch main

Create that project only if it does not already belong to another application. Use the URL Cloudflare actually returns; subdomain availability is not assumed.

A saved login was detected during implementation, but it does not grant **pages:write**. Deployment requires the owner to authorize the needed Pages permission. Do not use a different hosting product or broaden account permissions automatically to work around that boundary.

For dashboard Direct Upload, use the prepared [specscope-static.zip](evidence/specscope-static.zip). It contains the exported files at the archive root, including `index.html` and `_headers`. In Workers & Pages, create a Pages application using the drag-and-drop asset workflow and upload the ZIP. Dashboard upload accepts a ZIP or folder; Wrangler accepts the `out` folder. A Pages project configured for Git integration does not support dashboard drag-and-drop replacement. Use its Git build workflow instead.

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
