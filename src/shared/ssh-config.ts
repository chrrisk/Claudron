/**
 * Concrete Host aliases from ssh_config text. Wildcard and negated patterns are skipped.
 * `readInclude` resolves an Include pattern to file bodies; loops stop at depth 4.
 */
export function parseSshConfig(
  text: string,
  readInclude: (pattern: string) => string[] = () => [],
  depth = 0
): string[] {
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    const m = /^(host|include)\s*(?:=|\s)\s*(.+)$/i.exec(line)
    if (!m) continue
    const args = m[2]
      .trim()
      .split(/\s+/)
      .map((a) => a.replace(/^"|"$/g, ''))
      .filter(Boolean)
    if (m[1].toLowerCase() === 'host') {
      for (const a of args) if (!/[*?!]/.test(a)) out.push(a)
    } else if (depth < 4) {
      for (const pat of args) for (const body of readInclude(pat)) out.push(...parseSshConfig(body, readInclude, depth + 1))
    }
  }
  return [...new Set(out)]
}
