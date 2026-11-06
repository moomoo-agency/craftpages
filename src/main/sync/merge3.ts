/**
 * Three-way merge of text files, line by line (diff3): changes made on one side come in,
 * changes on both sides are kept when they touch different lines, and anything else is a
 * conflict (null). Used by sync when a page changed on two computers.
 *
 * Edits on neighbouring lines are combined: in HTML those are almost always separate
 * elements (a heading and the paragraph under it). Only lines changed on both sides, or
 * two different insertions at the same spot, are a conflict.
 */

interface Hunk {
  /** The base lines [start, end) replaced by `lines`. */
  start: number
  end: number
  lines: string[]
}

const TEXT = /\.(html?|css|m?js|json|md|markdown|txt|svg|xml|webmanifest)$/i

export const isMergeable = (path: string): boolean => TEXT.test(path)

function splitLines(text: string): string[] {
  return text.split(/(?<=\n)/)
}

/** The changes from `base` to `other`, as hunks over base lines (LCS on the middle part). */
function hunks(base: string[], other: string[]): Hunk[] {
  let prefix = 0
  while (prefix < base.length && prefix < other.length && base[prefix] === other[prefix]) prefix++
  let suffix = 0
  while (
    suffix < base.length - prefix &&
    suffix < other.length - prefix &&
    base[base.length - 1 - suffix] === other[other.length - 1 - suffix]
  )
    suffix++
  const a = base.slice(prefix, base.length - suffix)
  const b = other.slice(prefix, other.length - suffix)
  if (!a.length && !b.length) return []
  if (a.length * b.length > 25_000_000) {
    // Too big to align line by line: one hunk for the whole changed middle.
    return [{ start: prefix, end: base.length - suffix, lines: b }]
  }
  // LCS lengths, from the end.
  const width = b.length + 1
  const table = new Uint32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
  const out: Hunk[] = []
  let i = 0
  let j = 0
  let open: Hunk | null = null
  const close = (): void => {
    if (open) out.push(open)
    open = null
  }
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      close()
      i++
      j++
    } else if (
      j < b.length &&
      (i === a.length || table[i * width + j + 1] >= table[(i + 1) * width + j])
    ) {
      open ??= { start: prefix + i, end: prefix + i, lines: [] }
      open.lines.push(b[j++])
    } else {
      open ??= { start: prefix + i, end: prefix + i, lines: [] }
      i++
      open.end = prefix + i
    }
  }
  close()
  return out
}

const same = (x: Hunk, y: Hunk): boolean =>
  x.start === y.start && x.end === y.end && x.lines.join('') === y.lines.join('')

/**
 * The merged text, or null when both sides changed the same lines differently. With
 * `prefer`, such clashes take that side's lines instead, so everything that doesn't clash
 * is still merged: the two versions to choose between differ only where they clash.
 */
export function merge3(
  base: string,
  mine: string,
  theirs: string,
  prefer?: 'mine' | 'theirs'
): string | null {
  if (mine === theirs) return mine
  if (mine === base) return theirs
  if (theirs === base) return mine
  const lines = splitLines(base)
  const tagged = [
    ...hunks(lines, splitLines(mine)).map((hunk) => ({ hunk, side: 0 })),
    ...hunks(lines, splitLines(theirs)).map((hunk) => ({ hunk, side: 1 }))
  ].sort((x, y) => x.hunk.start - y.hunk.start || x.hunk.end - y.hunk.end)

  const out: string[] = []
  let at = 0
  let k = 0
  while (k < tagged.length) {
    // A group: hunks whose base ranges overlap, or insertions at the same spot.
    const group = [tagged[k]]
    let end = tagged[k].hunk.end
    k++
    const insertsAt = (at: number): boolean =>
      group.some(({ hunk }) => hunk.start === hunk.end && hunk.start === at)
    while (
      k < tagged.length &&
      (tagged[k].hunk.start < end ||
        (tagged[k].hunk.start === end &&
          tagged[k].hunk.start === tagged[k].hunk.end &&
          insertsAt(end)))
    ) {
      end = Math.max(end, tagged[k].hunk.end)
      group.push(tagged[k])
      k++
    }
    const start = group[0].hunk.start
    const sides = new Set(group.map((g) => g.side))
    out.push(...lines.slice(at, start))
    const take = (side: number): void => {
      // One side's hunks, with the base lines between them.
      let pos = start
      for (const { hunk } of group.filter((g) => g.side === side)) {
        out.push(...lines.slice(pos, hunk.start), ...hunk.lines)
        pos = hunk.end
      }
      out.push(...lines.slice(pos, end))
    }
    if (sides.size === 1) take(group[0].side)
    else if (group.length === 2 && same(group[0].hunk, group[1].hunk)) {
      out.push(...group[0].hunk.lines) // the same change on both sides
    } else if (prefer) take(prefer === 'mine' ? 0 : 1)
    else return null
    at = end
  }
  out.push(...lines.slice(at))
  return out.join('')
}
