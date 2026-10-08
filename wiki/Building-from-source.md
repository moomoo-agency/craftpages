# Building from source

You need [Node.js](https://nodejs.org) 22 or later, npm and git.

```bash
git clone https://github.com/moomoo-agency/craftpages.git
cd craftpages
npm install
npm run dev          # the app with hot reload; F12 opens DevTools
```

Open any folder with `.html` files to try it. Before a pull request:

```bash
npm run typecheck
npm run lint
npm run format       # prettier
```

The development build keeps its own settings (`CraftPages Dev` in the app data folder), so it
can run next to an installed CraftPages. If both run at once, give one of them another AI
port in **App settings**.

To see the update notice in development: `CP_FAKE_UPDATE=available npm run dev` (or
`downloading`, `ready`).

## Packaging

Build each system's installer on that system: `sharp`, the image library, ships a native
binary per platform, so an app packaged on one OS can't process images on another.

| Command                | Run on             | Output in `dist/`                             |
| ---------------------- | ------------------ | --------------------------------------------- |
| `npm run build:mac`    | macOS (either CPU) | `.dmg` and `.zip` for Apple Silicon and Intel |
| `npm run build:win`    | Windows            | NSIS installer `.exe` (x64)                   |
| `npm run build:linux`  | Linux              | `.AppImage` and `.deb` (x64)                  |
| `npm run build:unpack` | any                | unpacked app, for a quick test                |

`build:mac` adds the other Mac CPU's `sharp` binary before packaging
([`scripts/mac-sharp.mjs`](https://github.com/moomoo-agency/craftpages/blob/main/scripts/mac-sharp.mjs)); it doesn't change `package.json`.

## Releasing

[`.github/workflows/release.yml`](https://github.com/moomoo-agency/craftpages/blob/main/.github/workflows/release.yml) builds on macOS,
Windows and Linux runners when a version tag is pushed.

1. Set `"version"` in `package.json` (e.g. `1.0.1`) and commit:

   ```bash
   git add -A
   git commit -m "CraftPages 1.0.1"
   git push origin main
   ```

2. Tag that commit and push the tag:

   ```bash
   git tag -a v1.0.1 -m "CraftPages 1.0.1"
   git push origin v1.0.1
   ```

3. When the workflow finishes (about 15 minutes), the release is published under **Releases**
   with every installer plus the `latest*.yml` files the in-app update check reads (edit the
   notes there if you like). Installed apps see it within a few hours, or right away with
   **Check now**.

The tag must match `package.json` (`v1.0.1` ↔ `1.0.1`). To redo a tag after a failed build:

```bash
git tag -d v1.0.1
git push origin :refs/tags/v1.0.1
```

Then fix, commit, and tag again. The workflow can also be run by hand from **Actions**; the
installers are then kept as workflow artifacts, not a release.

## Signing

The Mac builds are signed with a Developer ID certificate and notarized by Apple. The
Release workflow passes these repository secrets to the macOS build only:

- `CSC_LINK`: the Developer ID Application certificate, a base64 `.p12`
  (`base64 -i cert.p12 | pbcopy`)
- `CSC_KEY_PASSWORD`: the `.p12` password
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`: for notarization

A local `npm run build:mac` without them still works, unsigned (electron-builder skips
signing and notarization when there is no certificate).

Windows builds are unsigned, so SmartScreen warns on first launch. To sign them, use a
code-signing certificate (`WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`) or Azure Trusted Signing;
see the [electron-builder docs](https://www.electron.build/code-signing).

## Project layout

Electron + React + TypeScript, built with [electron-vite](https://electron-vite.org). The main
process uses [parse5](https://github.com/inikulin/parse5) for HTML and
[sharp](https://sharp.pixelplumbing.com) for images.

```
src/
  main/              Electron main process
    ipc.ts             every IPC handler; workspace open/watch
    settings.ts        app settings (userData), secrets (OS keychain), .sitecms/site.json
    history.ts         all site writes go through here; backups in .sitecms/history for undo
    editing.ts         page edit sessions, save, per-page SEO
    html/              parse5 tooling: instrumenting, byte-range patches, SEO head fields,
                       body outline, shared-component fingerprints
    preview/           127.0.0.1 static server, the in-page editor script, screenshots
    images.ts          sharp import pipeline
    media.ts           media library, batch optimise, replace everywhere
    seo-site.ts        site-wide SEO check, sitemap, robots.txt
    search/            the site-search box that gets added to sites
    scheduler.ts       scheduled releases, background mode
    publish.ts         publishing, overwrite check, rollback
    deploy/            Cloudflare Workers static assets (and Pages direct upload), FTP / SFTP
    sync/              publish history (snapshots) and sync between computers;
                       worker/ is the Worker uploaded to the user's Cloudflare account
    code.ts            code mode: a page's own files, written through the history
    updates.ts         update check (electron-updater, GitHub releases)
    mcp/               WebSocket MCP server, tools, proposals (accept / reject / revert)
  preload/           contextBridge: a typed window.api (see src/shared/types.ts)
  shared/            types and helpers shared by main and renderer; feature switches
  renderer/          React UI (one view per sidebar item) and translations (en, it, uk)
build/               app icons and macOS entitlements
scripts/             build helpers
wiki/                these docs, published to the GitHub wiki on every push to main
```

Renderers run with `contextIsolation: true` and `nodeIntegration: false`. Anything that
touches the disk or the network goes through `window.api` → IPC → main.

## Feature switches

[`src/shared/features.ts`](https://github.com/moomoo-agency/craftpages/blob/main/src/shared/features.ts) turns off features that are built but
not part of this release:

- `pages`: publishing to Cloudflare Pages. Off so new projects only see Workers; projects
  already set to Pages keep working.
- `scheduling`: scheduled page edits (go live / come down at a set time), the Publish
  screen's list of them and background mode. Off for 1.1; the scheduler itself still runs,
  and scheduled posts work.

The blog, off in 1.0, is on since 1.1.

## Editing these docs

The wiki pages live in [`wiki/`](https://github.com/moomoo-agency/craftpages/blob/main/wiki) in the repository and are copied to the GitHub
wiki by [`.github/workflows/wiki.yml`](https://github.com/moomoo-agency/craftpages/blob/main/.github/workflows/wiki.yml) on every push to
`main`. Edit them there, not in the wiki itself (changes made on GitHub are overwritten).
Links between pages use `[[Page name]]`.
