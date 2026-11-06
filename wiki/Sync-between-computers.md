# Sync between computers

Sync lets you work on one project from several computers, or with several people. Every
computer gets the others' saved changes, unsaved edits and publish history, and sees who has
which page open.

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
2. **Projects → From another computer…**, choose where the sync data is, then
   **Find projects**.
3. **Download…** the project into an empty folder.

## Day to day

The pill above **Publish site** shows where you are: **Synced**, **Get changes from …**,
or **Sync your changes**. One click syncs. Every publish syncs too.

When another computer has the same project open, CraftPages says so ("Also open on …").
Give each computer a name in **Project settings → Sync** ("Rosa's laptop", "Office PC"):
it's shown there, in the pill and in **Publish history**.

Edits to the same page on two computers are combined when you sync, line by line: a new
headline here and a changed paragraph there both stay. Only when both computers changed the
same line does CraftPages stop and ask. Everything else is still combined, and
**Project settings → Sync** lists the file with **Compare** (what each version would lose),
**Keep mine** and **Use theirs**. Until you choose, publishing waits.

Publishing always syncs first: the other computers' work comes into this folder, then the
site goes up, so nobody's changes are overwritten.

The sync folder on a web host should sit next to the site's folder, not in it (the default
is `/craftpages-sync`). CraftPages refuses a sync folder inside the folder the site is
published to.

## Turning it off

**Turn off sync** stops syncing on this computer. Nothing is deleted, here or in the sync
store.

## What is synced

| Synced | Not synced |
|---|---|
| Every site file, including ones kept off the site | Tokens and passwords (each computer's keychain) |
| `site.json` (project settings), drafts, posts, original images | Local undo history |
| Publish history (who published what, and when) | Which connection this computer uses |
