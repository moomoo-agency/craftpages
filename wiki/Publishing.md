# Publishing

Once Cloudflare is set up ([[Setting up Cloudflare]]), click **Publish site** at the bottom
of the sidebar, then **Publish to production**.

- **Only changed files are uploaded.** The Publish screen says how many files changed since
  the last publish. The first publish uploads everything.
- **Before uploading,** CraftPages refreshes the sitemap (if automatic) and the site-search
  index.
- **Unsaved edits aren't published.** Click **Save all** first.

## Rolling back

**Publish → Deployments** lists recent versions. **Roll back…** puts an earlier one live
again, immediately. Your folder isn't changed: the next publish sends what's in the folder.

## "The live site was published from somewhere else"

CraftPages stops before publishing over a version that this folder didn't publish, because
that would wipe out someone else's changes. See [[Working with others]].
