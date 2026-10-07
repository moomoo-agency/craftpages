# Editing code

For the times clicking on the page isn't enough, the page editor has a **Code** mode: the
page's HTML and its own stylesheets and scripts, in the editor from VS Code, with a live
preview next to it.

## Turning it on

**Project settings → Editing → Show the code editor.** It's off for new projects, so a
client handed the site doesn't see it. Projects created before 1.1 have it on.

Then open a page and choose **Code** next to **Edit** and **Preview**.

## How it saves

Code is written straight to the file with **Write file now**, outside the drafts. Each write
is one step in the history, so it can be undone.

- A stylesheet or script used by other pages says so (e.g. "5 pages"): a change there changes
  all of them.
- If the page has unsaved visual edits, save or discard them first, so the two don't
  overwrite each other.
- If the file changed on disk since you opened it (another app, git), CraftPages won't
  overwrite it: **Load the version on disk** first.

The preview shows unsaved HTML right away; stylesheet and script changes appear once they
are written.
