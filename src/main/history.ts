import { copyFile, mkdir, readdir, readFile, rm, rmdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { APP_DIR } from './settings'
import { resolveWritable } from './workspace'

/**
 * Every write the app makes to site files goes through here. The previous
 * contents are kept in `.sitecms/history/<id>/` first, so any save, SEO edit
 * or accepted AI proposal can be reverted.
 */

export interface FileWrite {
  path: string
  /** `null` deletes the file. */
  content: string | Buffer | null
}

interface Manifest {
  label: string
  at: string
  files: { path: string; existed: boolean }[]
}

const KEEP = 200

const historyDir = (root: string): string => join(root, APP_DIR, 'history')

async function exists(file: string): Promise<boolean> {
  try {
    await readFile(file)
    return true
  } catch {
    return false
  }
}

export async function writeFiles(
  root: string,
  writes: FileWrite[],
  label: string
): Promise<string> {
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 7)}`
  const dir = join(historyDir(root), id)
  const manifest: Manifest = { label, at: new Date().toISOString(), files: [] }

  for (const write of writes) {
    const full = resolveWritable(root, write.path)
    const existed = await exists(full)
    if (existed) {
      const backup = join(dir, 'files', write.path)
      await mkdir(dirname(backup), { recursive: true })
      await copyFile(full, backup)
    }
    manifest.files.push({ path: write.path, existed })
  }
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  for (const write of writes) {
    const full = resolveWritable(root, write.path)
    if (write.content === null) {
      await rm(full, { force: true })
      await removeEmptyParents(root, dirname(full))
    } else {
      await mkdir(dirname(full), { recursive: true })
      await writeFile(full, write.content)
    }
  }

  await prune(root)
  return id
}

/** Puts every file touched by a history entry back the way it was before. */
export async function revert(root: string, id: string): Promise<void> {
  if (!/^[\w-]+$/.test(id)) throw new Error('Invalid history id')
  const dir = join(historyDir(root), id)
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as Manifest
  const restores: FileWrite[] = []
  for (const file of manifest.files) {
    restores.push({
      path: file.path,
      content: file.existed ? await readFile(join(dir, 'files', file.path)) : null
    })
  }
  await writeFiles(root, restores, `Revert: ${manifest.label}`)
}

/** After a delete, drops folders left empty (up to, not including, the site root). */
async function removeEmptyParents(root: string, dir: string): Promise<void> {
  while (dir.startsWith(root) && dir !== root) {
    try {
      await rmdir(dir) // fails when not empty, which ends the walk
    } catch {
      return
    }
    dir = dirname(dir)
  }
}

async function prune(root: string): Promise<void> {
  const entries = (await readdir(historyDir(root))).sort()
  const old = entries.slice(0, Math.max(0, entries.length - KEEP))
  await Promise.all(old.map((name) => rm(join(historyDir(root), name), { recursive: true })))
}
