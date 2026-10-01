<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/wordmark-dark.svg">
    <img src="docs/wordmark.svg" alt="CraftPages" width="320">
  </picture>
</p>

<p align="center">
  A free, open-source desktop CMS for plain-HTML static sites.<br>
  Edit text, images and SEO right on the page, then publish to Cloudflare.<br>
  Your HTML stays the site: no database, no server, no rebuild step.
</p>

<p align="center">
  <a href="https://github.com/moomoo-agency/craftpages/releases/latest"><b>Download</b></a> ·
  <a href="https://github.com/moomoo-agency/craftpages/wiki">Docs</a> ·
  <a href="https://craftpages.app">Website</a>
</p>

---

CraftPages opens the site folder you already have (hand-written, exported from a site
builder, made by an AI) and makes it editable. Changes are written back into your files byte
for byte: untouched markup stays identical.

- **Edit in place:** click text to change it; swap images and alt text; paste from Google
  Docs and get clean markup.
- **Shared parts:** edit a header, footer or nav once, on every page that has it.
- **Repeating lists:** move, duplicate or delete cards, team members and list items.
- **Drafts and undo:** nothing is written until **Save all**, and every save can be reverted.
- **SEO and media:** per-page SEO, a site check, sitemap, and batch image optimisation.
- **Site search:** a fast search box for your site, with no service behind it.
- **Publish to Cloudflare:** free static hosting, only changed files uploaded, rollback.
- **Bring your own AI:** Claude, Cursor or any MCP client can propose template changes;
  you accept or reject each diff.

## Get started

1. [Download](https://github.com/moomoo-agency/craftpages/releases/latest) for macOS,
   Windows or Linux, and [install it](https://github.com/moomoo-agency/craftpages/wiki/Installing).
2. Open your [site folder](https://github.com/moomoo-agency/craftpages/wiki/Your-site-folder).
3. [Set up Cloudflare](https://github.com/moomoo-agency/craftpages/wiki/Setting-up-Cloudflare) once, then [publish](https://github.com/moomoo-agency/craftpages/wiki/Publishing).

Everything else is in the [docs](https://github.com/moomoo-agency/craftpages/wiki): [upgrading](https://github.com/moomoo-agency/craftpages/wiki/Upgrading),
[working with others](https://github.com/moomoo-agency/craftpages/wiki/Working-with-others), [connecting an AI](https://github.com/moomoo-agency/craftpages/wiki/Connect-an-AI),
[troubleshooting](https://github.com/moomoo-agency/craftpages/wiki/Troubleshooting).

## Develop

```bash
git clone https://github.com/moomoo-agency/craftpages.git
cd craftpages
npm install
npm run dev
```

Node.js 22 or later. Packaging, releases and the code layout:
[Building from source](https://github.com/moomoo-agency/craftpages/wiki/Building-from-source). Issues and pull requests are welcome; please
run `npm run typecheck` and `npm run lint` first.

## License

[GPL-3.0-or-later](LICENSE). CraftPages includes the WordPress block editor (Gutenberg),
which is GPL-2.0-or-later. © 2026 Vitalii Kiiko
