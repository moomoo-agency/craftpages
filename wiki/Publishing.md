# Publishing

CraftPages publishes to **Cloudflare** (free static hosting, see [[Setting up Cloudflare]])
or to **any web host over FTP, FTPS or SFTP** (see [[Publishing to a web host]]). Once that's
set up, click **Publish site** at the bottom of the sidebar, then **Publish to the live
site**.

- **Only changed files are uploaded.** The Publish screen lists the pages that change with
  the next publish. The first publish uploads everything.
- **Before uploading,** CraftPages refreshes the sitemap (if automatic) and the site-search
  index.
- **Unsaved edits aren't published.** If some pages have unsaved edits, the Publish screen
  names them and offers **Save all and publish**, or **Publish without them**.

## Publish history

Every publish is kept as a version in the project folder (`.sitecms/store/`), with what
changed: new, changed and removed files, who published it and where. **Publish → Publish
history** lists them.

- **Restore…** puts the site files in the folder back as they were in that version. It can
  be undone. Publish afterwards to put it live.
- **Save as folder…** writes that version out as a complete, separate project.

Unchanged files are stored once, however many versions hold them, so history takes little
space.

## Rolling back on Cloudflare

**Publish → On Cloudflare** lists the versions Cloudflare keeps. **Roll back…** puts an
earlier one live again, immediately. Your folder isn't changed: the next publish sends what's
in the folder. (A web host keeps no versions: use **Restore…** in Publish history, then
publish.)

## "The live site was published from somewhere else"

CraftPages stops before publishing over a version that this folder didn't publish, because
that would wipe out someone else's changes. See [[Working with others]].
