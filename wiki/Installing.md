# Installing

Download the file for your system from the
[latest release](https://github.com/moomoo-agency/craftpages/releases/latest):

| System                              | File                         |
| ----------------------------------- | ---------------------------- |
| macOS, Apple Silicon (M1 and later) | `CraftPages-arm64.dmg`       |
| macOS, Intel                        | `CraftPages-x64.dmg`         |
| Windows 10 / 11 (64-bit)            | `CraftPages-Setup.exe`       |
| Linux x64, any distribution         | `CraftPages-x86_64.AppImage` |
| Linux x64, Debian / Ubuntu          | `craftpages_amd64.deb`       |

Not sure which Mac you have? Apple menu → **About This Mac**: "Chip: Apple M…" means Apple
Silicon, "Processor: Intel…" means Intel. macOS 12 Monterey or later is required.

## macOS

1. Open the `.dmg` and drag **CraftPages** into **Applications**.
2. Open CraftPages from Applications. The first time, macOS says it can't verify the app,
   because the builds aren't signed with an Apple developer certificate yet.
3. Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway**
   next to CraftPages. Confirm once more. From then on it opens normally.

If macOS says the app "is damaged and can't be opened", that is the same check. Run this
in Terminal, then open the app again:

```bash
xattr -cr /Applications/CraftPages.app
```

## Windows

1. Run `CraftPages-Setup.exe`.
2. If **Windows protected your PC** (SmartScreen) appears, click **More info → Run anyway**.
   It shows because the installer isn't signed yet.
3. CraftPages is added to the Start menu and the desktop.

## Linux

**AppImage** (any distribution):

```bash
chmod +x CraftPages-*.AppImage
./CraftPages-*.AppImage
```

On Ubuntu 22.04 and later you may need FUSE: `sudo apt install libfuse2`
(on 24.04: `sudo apt install libfuse2t64`).

**Debian / Ubuntu package**:

```bash
sudo apt install ./craftpages_amd64.deb
```

## First steps

1. Click **Open project…** and pick your site's folder (see [[Your site folder]]).
2. Click any text on a page to edit it; **Save all** (⌘S / Ctrl+S) writes your changes.
3. To publish, set up Cloudflare once: [[Setting up Cloudflare]].
