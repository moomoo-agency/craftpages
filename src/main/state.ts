import { BrowserWindow } from 'electron'
import type { AppEvent, Workspace } from '../shared/types'

let workspace: Workspace | null = null
const listeners = new Set<(workspace: Workspace | null) => void>()

export function getWorkspace(): Workspace | null {
  return workspace
}

/** The open site's root folder, or an error the caller can show as-is. */
export function requireRoot(): string {
  if (!workspace) throw new Error('No site is open. Open a site folder in CraftPages first.')
  return workspace.root
}

export function setWorkspace(next: Workspace | null): void {
  const rootChanged = next?.root !== workspace?.root
  workspace = next
  broadcast({ type: 'workspace', workspace })
  if (rootChanged) listeners.forEach((listener) => listener(next))
}

/** Called when a different site folder is opened (not on rescans of the same one). */
export function onWorkspaceSwitch(listener: (workspace: Workspace | null) => void): void {
  listeners.add(listener)
}

export function broadcast(event: AppEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('app:event', event)
  }
}
