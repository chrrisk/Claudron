import { describe, expect, it } from 'vitest'
import { diffLines, diffStats, findStartLine, withContext } from '../src/shared/diff'

describe('diffLines', () => {
  it('puts removals before additions for a changed line', () => {
    const d = diffLines('  return 0;', "  const last = localStorage.getItem('lastPlayed');\n  return 0;")
    expect(d.map((l) => l.kind)).toEqual(['add', 'ctx'])
    const changed = diffLines('a\nb\nc', 'a\nB\nc')
    expect(changed.map((l) => l.kind)).toEqual(['ctx', 'del', 'add', 'ctx'])
  })

  it('numbers lines from the start line', () => {
    const d = diffLines('x\ny', 'x\nz', 12)
    expect(d[0]).toMatchObject({ kind: 'ctx', oldNo: 12, newNo: 12 })
    expect(d[1]).toMatchObject({ kind: 'del', oldNo: 13 })
    expect(d[2]).toMatchObject({ kind: 'add', newNo: 13 })
  })

  it('treats empty input as a pure addition', () => {
    const d = diffLines('', 'one\ntwo')
    expect(diffStats(d)).toEqual({ added: 2, removed: 0 })
  })
})

describe('findStartLine', () => {
  it('reads the line number out of a cat -n snippet', () => {
    const result = [
      "The file src/lib/streak.ts has been updated. Here's the result of running `cat -n` on a snippet:",
      '    12→export function getStreak() {',
      "    13→  const last = localStorage.getItem('lastPlayed');",
      '    14→  if (!last) return 0;'
    ].join('\n')
    expect(findStartLine(result, "  const last = localStorage.getItem('lastPlayed');\n  if (!last) return 0;")).toBe(13)
  })

  it('returns null when it cannot tell', () => {
    expect(findStartLine(undefined, 'x')).toBeNull()
    expect(findStartLine('no numbers here', 'x')).toBeNull()
  })
})

describe('withContext', () => {
  it('collapses long unchanged runs into a gap', () => {
    const before = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n')
    const after = before.replace('l10', 'L10')
    const out = withContext(diffLines(before, after), 1)
    expect(out.map((l) => l.kind)).toEqual(['ctx', 'del', 'add', 'ctx'])
  })
})
