export interface DiffLine {
  type: 'same' | 'add' | 'del'
  text: string
  /** Line numbers in the old / new file (1-based). */
  a?: number
  b?: number
}

export interface DiffHunk {
  lines: DiffLine[]
}

/**
 * Line diff (LCS) with the common prefix and suffix trimmed first, so the
 * quadratic part only covers the region that actually changed.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const out: DiffLine[] = a
    .slice(0, start)
    .map((text, i) => ({ type: 'same', text, a: i + 1, b: i + 1 }))

  if (midA.length * midB.length > 4_000_000) {
    // Too big to align line by line: show it as a block replacement.
    midA.forEach((text, i) => out.push({ type: 'del', text, a: start + i + 1 }))
    midB.forEach((text, i) => out.push({ type: 'add', text, b: start + i + 1 }))
  } else {
    const n = midA.length
    const m = midB.length
    const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i][j] =
          midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        out.push({ type: 'same', text: midA[i], a: start + i + 1, b: start + j + 1 })
        i++
        j++
      } else if (i < n && (j === m || table[i + 1][j] >= table[i][j + 1])) {
        // Removals first, then additions, like `git diff`.
        out.push({ type: 'del', text: midA[i], a: start + i + 1 })
        i++
      } else {
        out.push({ type: 'add', text: midB[j], b: start + j + 1 })
        j++
      }
    }
  }

  a.slice(endA).forEach((text, k) =>
    out.push({ type: 'same', text, a: endA + k + 1, b: endB + k + 1 })
  )
  return out
}

/** Groups a diff into hunks with `context` unchanged lines around each change. */
export function hunks(lines: DiffLine[], context = 3): DiffHunk[] {
  const keep = new Array(lines.length).fill(false)
  lines.forEach((line, index) => {
    if (line.type === 'same') return
    for (
      let k = Math.max(0, index - context);
      k <= Math.min(lines.length - 1, index + context);
      k++
    )
      keep[k] = true
  })
  const result: DiffHunk[] = []
  let current: DiffLine[] | null = null
  lines.forEach((line, index) => {
    if (keep[index]) {
      if (!current) result.push({ lines: (current = []) })
      current.push(line)
    } else {
      current = null
    }
  })
  return result
}
