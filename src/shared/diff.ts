export type DiffLine = { kind: 'ctx' | 'add' | 'del'; text: string; oldNo?: number; newNo?: number }

/**
 * Line diff via LCS. Edit payloads are small (a few dozen lines), so the
 * quadratic table is fine; huge inputs fall back to "all removed, all added".
 */
export function diffLines(before: string, after: string, startLine = 1): DiffLine[] {
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  if (a.length * b.length > 250_000) {
    return [
      ...a.map((text, i) => ({ kind: 'del' as const, text, oldNo: startLine + i })),
      ...b.map((text, i) => ({ kind: 'add' as const, text, newNo: startLine + i }))
    ]
  }
  const n = a.length
  const m = b.length
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      out.push({ kind: 'ctx', text: a[i], oldNo: startLine + i, newNo: startLine + j })
      i++
      j++
    } else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
      // removals first, so a changed line reads "- old" then "+ new"
      out.push({ kind: 'del', text: a[i], oldNo: startLine + i })
      i++
    } else {
      out.push({ kind: 'add', text: b[j], newNo: startLine + j })
      j++
    }
  }
  return out
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const l of lines) {
    if (l.kind === 'add') added++
    else if (l.kind === 'del') removed++
  }
  return { added, removed }
}

/**
 * Claude Code's Edit result includes a `cat -n` style snippet of the file after
 * the change. Use it to recover the real line number where `newText` starts.
 */
export function findStartLine(resultText: string | undefined, newText: string): number | null {
  if (!resultText) return null
  const first = newText.split('\n').find((l) => l.trim() !== '')
  if (!first) return null
  const firstIdx = newText.split('\n').indexOf(first)
  for (const raw of resultText.split('\n')) {
    const m = /^\s*(\d+)[\t→](.*)$/.exec(raw)
    if (m && m[2] === first) return Number(m[1]) - firstIdx
  }
  return null
}

/** Trims a diff to changed lines plus `context` lines around them. */
export function withContext(lines: DiffLine[], context = 2): (DiffLine | { kind: 'gap' })[] {
  const keep = new Array(lines.length).fill(false)
  lines.forEach((l, i) => {
    if (l.kind === 'ctx') return
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true
  })
  const out: (DiffLine | { kind: 'gap' })[] = []
  let gap = false
  lines.forEach((l, i) => {
    if (keep[i]) {
      out.push(l)
      gap = false
    } else if (!gap && out.length > 0) {
      out.push({ kind: 'gap' })
      gap = true
    }
  })
  if (out[out.length - 1]?.kind === 'gap') out.pop()
  return out
}
