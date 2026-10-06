import { describe, expect, it } from 'vitest'
import { composeNotes, AGENT_NOTE_MAX } from '../src/shared/notes'

describe('composeNotes', () => {
  it('returns no args when there is nothing to say', () => {
    expect(composeNotes('', [])).toEqual([])
    expect(composeNotes('   \n ', [])).toEqual([])
  })
  it('joins the user note and extras into one flag', () => {
    expect(composeNotes(' always use pnpm ', ['sudo -A please'])).toEqual([
      '--append-system-prompt',
      'For the record, from the user (applies to every session):\nalways use pnpm\n\nsudo -A please'
    ])
    expect(composeNotes('', ['x'])).toEqual(['--append-system-prompt', 'x'])
  })
  it('caps the user note', () => {
    const out = composeNotes('a'.repeat(AGENT_NOTE_MAX + 50), [])[1]
    expect(out.length).toBeLessThan(AGENT_NOTE_MAX + 120)
  })
})
