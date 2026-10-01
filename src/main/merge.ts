import { diffLines } from '../shared/diff'

/**
 * Applies the change `base → target` onto `current` (the file as it is now),
 * line by line. Each changed region must still be in `current` exactly as it
 * was in `base`, including the line on either side; otherwise the edits
 * overlap and the result is `null`, never a guess.
 */
export function mergeInto(base: string, target: string, current: string): string | null {
  if (current === base) return target
  if (current === target) return current

  const lines = (text: string): string[] => (text === '' ? [] : text.split('\n'))
  const baseLines = lines(base)
  const out = lines(current)

  // Where each unchanged base line sits in the current file; the ends are fixed anchors.
  const at = new Map<number, number>([
    [-1, -1],
    [baseLines.length, out.length]
  ])
  for (const line of diffLines(base, current)) {
    if (line.type === 'same') at.set(line.a! - 1, line.b! - 1)
  }

  // Changed regions of base → target: base lines [start, end) become `insert`.
  const regions: { start: number; end: number; insert: string[] }[] = []
  let index = 0
  let open: { start: number; end: number; insert: string[] } | null = null
  for (const line of diffLines(base, target)) {
    if (line.type === 'same') {
      if (open) regions.push(open)
      open = null
      index++
      continue
    }
    open ??= { start: index, end: index, insert: [] }
    if (line.type === 'del') open.end = ++index
    else open.insert.push(line.text)
  }
  if (open) regions.push(open)

  // Last region first, so earlier line numbers in `out` stay valid.
  for (const { start, end, insert } of regions.reverse()) {
    for (let k = start - 1; k < end; k++) {
      const here = at.get(k)
      const next = at.get(k + 1)
      if (here === undefined || next === undefined || next !== here + 1) return null
    }
    const from = at.get(start - 1)! + 1
    out.splice(from, end - start, ...insert)
  }
  return out.join('\n')
}
