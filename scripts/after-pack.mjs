// electron-builder afterPack hook (electron-builder.yml).
//
// The Mac build makes an Apple Silicon and an Intel app from one node_modules, which holds
// sharp's native binary for both CPUs (scripts/mac-sharp.mjs adds the other one). Each app
// needs only its own: the other CPU's libvips is ~20 MB in every Mac download. It is unpacked
// (asarUnpack), so it is a plain folder here, removed before the app is signed.
// Other platforms build one CPU and are left alone.
// Plain JS run by electron-builder: no types to annotate.
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

// electron-builder's Arch enum: x64 = 1, arm64 = 3.
const CPU = { 1: 'x64', 3: 'arm64' }

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const own = CPU[context.arch]
  if (!own) return
  const other = own === 'arm64' ? 'x64' : 'arm64'
  const app = `${context.packager.appInfo.productFilename}.app`
  const dir = join(context.appOutDir, app, 'Contents/Resources/app.asar.unpacked/node_modules/@img')
  let names
  try {
    names = await readdir(dir)
  } catch {
    return
  }
  // Only the other CPU's packages: sharp-darwin-x64, sharp-libvips-darwin-x64 (or arm64).
  const unwanted = names.filter((name) => name.endsWith(`-darwin-${other}`))
  // Never leave the app without its own binary.
  if (!names.some((name) => name.endsWith(`-darwin-${own}`))) return
  for (const name of unwanted) await rm(join(dir, name), { recursive: true, force: true })
  if (unwanted.length) console.log(`  • removed ${unwanted.join(', ')} from the ${own} app`)
}
