// The Mac build makes Apple Silicon and Intel apps, but npm installs sharp's native
// binary for this Mac's CPU only. This adds the other CPU's binary: npm only honours
// --cpu on a fresh install of sharp itself, so it is installed in a temporary folder
// and copied into node_modules/@img. package.json and the lockfile are not touched.
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const other = process.arch === 'arm64' ? 'x64' : 'arm64'
const sharp = JSON.parse(readFileSync('node_modules/sharp/package.json', 'utf8'))
const names = [`@img/sharp-darwin-${other}`, `@img/sharp-libvips-darwin-${other}`]

if (names.every((name) => existsSync(join('node_modules', name, 'package.json')))) process.exit(0)

const dir = mkdtempSync(join(tmpdir(), 'craftpages-sharp-'))
try {
  execSync(`npm install --no-package-lock --os=darwin --cpu=${other} sharp@${sharp.version}`, {
    cwd: dir,
    stdio: 'inherit'
  })
  for (const name of names)
    cpSync(join(dir, 'node_modules', name), join('node_modules', name), { recursive: true })
} finally {
  rmSync(dir, { recursive: true, force: true })
}
