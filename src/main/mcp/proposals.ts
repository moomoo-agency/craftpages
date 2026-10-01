import { randomBytes } from 'crypto'
import { readFile } from 'fs/promises'
import { hasDraft } from '../drafts'
import { revert, writeFiles } from '../history'
import { broadcast, requireRoot } from '../state'
import { resolveInWorkspace } from '../workspace'
import type { Proposal, ProposalFile } from '../../shared/types'

/**
 * AI changes never go straight to disk: each `propose_change` becomes a
 * pending proposal the user accepts or rejects in the Template editing view.
 */

export interface EditOp {
  old_text: string
  new_text: string
  replace_all?: boolean
}

export interface ChangeOp {
  path: string
  action: 'edit' | 'write' | 'delete'
  edits?: EditOp[]
  content?: string
}

const proposals: Proposal[] = []
const waiters = new Map<string, Set<() => void>>()
let autoAccept = false
const decisionListeners = new Set<(proposal: Proposal) => void>()

function changed(proposal?: Proposal): void {
  broadcast({ type: 'proposals', proposals: listProposals() })
  if (proposal && proposal.status !== 'pending') {
    waiters.get(proposal.id)?.forEach((wake) => wake())
    waiters.delete(proposal.id)
    decisionListeners.forEach((listener) => listener(proposal))
  }
}

export function onDecision(listener: (proposal: Proposal) => void): void {
  decisionListeners.add(listener)
}

export function listProposals(): Proposal[] {
  return [...proposals].reverse()
}

export function getProposal(id: string): Proposal {
  const proposal = proposals.find((p) => p.id === id)
  if (!proposal) throw new Error(`No proposal with id ${id}`)
  return proposal
}

export function isAutoAccept(): boolean {
  return autoAccept
}

export function setAutoAccept(on: boolean): void {
  autoAccept = on
}

export function clearProposals(): void {
  proposals.length = 0
  changed()
}

async function readCurrent(root: string, path: string): Promise<string | null> {
  try {
    return await readFile(resolveInWorkspace(root, path), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function applyEdits(path: string, source: string, edits: EditOp[]): string {
  let out = source
  edits.forEach((edit, index) => {
    const where = `${path}, edit ${index + 1}`
    if (!edit.old_text) throw new Error(`${where}: old_text is empty`)
    const count = out.split(edit.old_text).length - 1
    if (count === 0)
      throw new Error(
        `${where}: old_text not found. Re-read the file; it must match exactly, whitespace included.`
      )
    if (count > 1 && !edit.replace_all) {
      throw new Error(
        `${where}: old_text appears ${count} times. Add surrounding context to make it unique, or set replace_all.`
      )
    }
    out = edit.replace_all
      ? out.split(edit.old_text).join(edit.new_text)
      : out.replace(edit.old_text, () => edit.new_text)
  })
  return out
}

/** Validates the changes against the files as they are now and records a pending proposal. */
export async function createProposal(
  title: string,
  description: string,
  client: string,
  changes: ChangeOp[]
): Promise<Proposal> {
  const root = requireRoot()
  if (!Array.isArray(changes) || changes.length === 0)
    throw new Error('changes must list at least one file')
  const files: ProposalFile[] = []
  for (const change of changes) {
    const path = change.path.replace(/\\/g, '/').replace(/^\/+/, '')
    resolveInWorkspace(root, path)
    if (files.some((file) => file.path === path))
      throw new Error(`${path} appears twice; combine its edits`)
    const before = await readCurrent(root, path)
    let after: string | null
    if (change.action === 'delete') {
      if (before === null) throw new Error(`${path} doesn't exist`)
      after = null
    } else if (change.action === 'write') {
      if (typeof change.content !== 'string') throw new Error(`${path}: write needs content`)
      after = change.content
    } else if (change.action === 'edit') {
      if (before === null) throw new Error(`${path} doesn't exist; use action "write" to create it`)
      after = applyEdits(path, before, change.edits ?? [])
    } else {
      throw new Error(`${path}: unknown action ${String(change.action)}`)
    }
    if (after === before) continue
    files.push({ path, before, after })
  }
  if (files.length === 0) throw new Error('These changes would not change any file')

  const proposal: Proposal = {
    id: randomBytes(4).toString('hex'),
    root,
    title: title || 'Untitled change',
    description,
    client,
    createdAt: new Date().toISOString(),
    status: 'pending',
    files
  }
  proposals.push(proposal)
  changed()
  if (autoAccept) await acceptProposal(proposal.id)
  return proposal
}

export async function acceptProposal(id: string): Promise<void> {
  const proposal = getProposal(id)
  if (proposal.status !== 'pending') throw new Error(`Proposal is already ${proposal.status}`)
  const root = requireRoot()
  if (proposal.root !== root) throw new Error('This proposal belongs to another project.')
  // Not a failure of the proposal: the user can save or discard, then accept again.
  const unsaved = proposal.files.filter((file) => hasDraft(file.path)).map((file) => file.path)
  if (unsaved.length > 0) {
    throw new Error(
      `Unsaved edits on ${unsaved.join(', ')}. Save or discard them, then accept again.`
    )
  }
  try {
    for (const file of proposal.files) {
      if ((await readCurrent(root, file.path)) !== file.before) {
        throw new Error(`${file.path} changed since the proposal was made`)
      }
    }
    proposal.historyId = await writeFiles(
      root,
      proposal.files.map((file) => ({ path: file.path, content: file.after })),
      `AI: ${proposal.title}`
    )
    proposal.status = 'accepted'
  } catch (error) {
    proposal.status = 'failed'
    proposal.reason = (error as Error).message
  }
  changed(proposal)
}

export function rejectProposal(id: string, reason?: string): void {
  const proposal = getProposal(id)
  if (proposal.status !== 'pending') throw new Error(`Proposal is already ${proposal.status}`)
  proposal.status = 'rejected'
  proposal.reason = reason?.trim() || undefined
  changed(proposal)
}

export async function revertProposal(id: string): Promise<void> {
  const proposal = getProposal(id)
  if (proposal.status !== 'accepted' || !proposal.historyId)
    throw new Error('Only accepted proposals can be reverted')
  await revert(requireRoot(), proposal.historyId)
  proposal.status = 'reverted'
  changed(proposal)
}

/** Resolves when the proposal is decided or the timeout passes. */
export function waitForDecision(id: string, seconds: number): Promise<Proposal> {
  const proposal = getProposal(id)
  if (proposal.status !== 'pending' || seconds <= 0) return Promise.resolve(proposal)
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer)
      waiters.get(id)?.delete(done)
      resolve(proposal)
    }
    const timer = setTimeout(done, seconds * 1000)
    waiters.set(id, (waiters.get(id) ?? new Set()).add(done))
  })
}
