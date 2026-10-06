export const AGENT_NOTE_MAX = 2000

/**
 * One --append-system-prompt flag from the user's "for the record" note plus
 * Claudron's own notes. Claude Code takes the flag once, so everything is merged.
 */
export function composeNotes(userNote: string, extras: string[]): string[] {
  const parts: string[] = []
  const note = userNote.trim().slice(0, AGENT_NOTE_MAX)
  if (note) parts.push(`For the record, from the user (applies to every session):\n${note}`)
  parts.push(...extras.filter(Boolean))
  return parts.length ? ['--append-system-prompt', parts.join('\n\n')] : []
}
