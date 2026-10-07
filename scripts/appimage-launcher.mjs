// electron-builder afterPack hook for the AppImage build only (see build:linux).
//
// Electron's sandbox needs unprivileged user namespaces with full rights. Ubuntu 24.04 and
// the desktops based on it (Zorin OS 18, Linux Mint 22, Pop!_OS…) restrict them through
// AppArmor, and an AppImage can't carry the SUID chrome-sandbox fallback, so the app
// aborts before any of our code runs. The .deb installs an AppArmor profile instead; the
// AppImage gets this launcher: the real binary becomes <name>.bin, and <name> is a script
// that adds --no-sandbox only on systems where the sandbox can't start.
// electron-builder's own AppRun probes with `unshare -Ur true`, which still succeeds under
// the AppArmor restriction (it removes capabilities inside the namespace, not the namespace).
// Plain JS run by electron-builder: no types to annotate.
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { chmod, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const launcher = (bin) => `#!/bin/sh
# CraftPages launcher (AppImage): starts ${bin} without Chromium's sandbox only where the
# system doesn't allow it, instead of failing to open.
here="$(dirname "$(readlink -f "$0")")"
restricted() {
  [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = 1 ] && return 0
  [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = 0 ] && return 0
  ! unshare -Ur true 2>/dev/null
}
if restricted; then
  exec "$here/${bin}" --no-sandbox "$@"
fi
exec "$here/${bin}" "$@"
`

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return
  const name = context.packager.executableName
  const dir = context.appOutDir
  await rename(join(dir, name), join(dir, `${name}.bin`))
  await writeFile(join(dir, name), launcher(`${name}.bin`))
  await chmod(join(dir, name), 0o755)
}
