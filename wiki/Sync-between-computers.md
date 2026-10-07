# Sync between computers (beta)

Sync lets you work on one project from several computers, or with several people. Every
computer gets the others' saved changes, unsaved edits and publish history, and sees who has
which page open.

> **Beta.** Sync is new in 1.1. Keep a backup of the site folder (git, or a copy saved from
> **Publish history**) while it settles, and
> [tell us](https://github.com/moomoo-agency/craftpages/issues) how it goes.

## Where the sync data lives

You choose, per project, in **Project settings → Sync between computers**:

- **Cloudflare** (your own account). Turning sync on sets up a small Worker named
  `craftpages-sync` and an R2 bucket, both within Cloudflare's free tier. Changes and who's
  editing show up on the other computers within seconds. The API token needs
  **Workers Scripts · Edit** and **Workers R2 Storage · Edit**; if yours can only publish,
  CraftPages says so and links to a token with both. R2 has to be turned on once in the
  Cloudflare dashboard.
- **An FTP / SFTP server.** A folder on your hosting, encrypted with a passphrase you
  choose. Keep it outside the website folder (next to `public_html`, not in it). The other
  computers notice changes within a minute or so. The passphrase can't be recovered: every
  computer needs it, so keep it somewhere safe.

Tokens, passwords and the passphrase stay in each computer's keychain. Nothing is sent
anywhere else: there's no CraftPages server in between.

## Getting the project on another computer

1. Add the same connection there (**App settings → Deploy connections**).
2. **Projects → From another computer (beta)…**, choose where the sync data is, then
   **Find projects**.
3. **Download…** the project into an empty folder.

## Day to day

The pill above **Publish site** shows where you are: **Synced**, **Get changes from …**,
or **Sync your changes**. One click syncs. Every publish syncs too.

When another computer has the same project open, CraftPages says so ("Also open on …").
Edits to the same page on two computers are merged when you sync. If both changed the same
file, this folder keeps its own version, the other computer's copy is saved in
`.sitecms/conflicts/`, and **Project settings → Sync** lists the file with **Use theirs**.

## Turning it off

**Turn off sync** stops syncing on this computer. Nothing is deleted, here or in the sync
store.

## What is synced

| Synced | Not synced |
|---|---|
| Every site file, including ones kept off the site | Tokens and passwords (each computer's keychain) |
| `site.json` (project settings), drafts, posts, original images | Local undo history |
| Publish history (who published what, and when) | Which connection this computer uses |
