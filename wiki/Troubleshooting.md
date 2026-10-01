# Troubleshooting

**macOS: "CraftPages can't be opened" / "is damaged".** The app isn't signed yet. See
[Installing](Installing#macos): **System Settings → Privacy & Security → Open Anyway**, or
`xattr -cr /Applications/CraftPages.app`.

**Windows: "Windows protected your PC".** Click **More info → Run anyway**.

**Linux: the AppImage doesn't start.** Make it executable (`chmod +x`) and install FUSE
(`libfuse2`, or `libfuse2t64` on Ubuntu 24.04).

**"The token can't publish Workers."** The token needs **Account · Workers Scripts · Edit**
for the right account. See [[Setting up Cloudflare]], step 3.

**"The account has no workers.dev subdomain yet."** Open **Workers & Pages** in the
Cloudflare dashboard once and choose a subdomain, or add a custom domain to the Worker.

**"… is over Cloudflare's 25 MiB file limit."** Make the file smaller, host it elsewhere
(videos: YouTube, Vimeo, Cloudflare Stream), or add it to **Never upload**.

**A Worker isn't listed in Project settings.** Workers that run their own code are hidden,
because publishing a site to them would replace that code. Use a new name.

**"The live site was published from somewhere else."** Someone published from another
copy of the folder. See [[Working with others]].

**"Port 7424 is already in use."** Another app (or a second CraftPages) uses the AI port.
Pick another one in **App settings**.

**Files I didn't expect are online.** Everything in the folder is published except
dot-files, `node_modules` and **Never upload** patterns. See [[Your site folder]].

Still stuck? [Open an issue](https://github.com/moomoo-agency/craftpages/issues) with what
you did, what happened and your system.
