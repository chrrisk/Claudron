import { describe, expect, it } from 'vitest'
import { toolResultText, translateMessage } from '../src/main/agent-translate'

describe('translateMessage', () => {
  it('splits assistant content into text and tool events', () => {
    const events = translateMessage('assistant', 'u1', {
      content: [
        { type: 'text', text: 'Reading first.' },
        { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: '/x/a.ts' } },
        { type: 'thinking', thinking: 'hidden' }
      ]
    })
    expect(events).toEqual([
      { type: 'text', id: 'u1:0', text: 'Reading first.' },
      { type: 'tool', id: 'toolu_1', name: 'Read', input: { file_path: '/x/a.ts' } }
    ])
  })

  it('maps tool results and hides injected reminders', () => {
    const events = translateMessage('user', 'u2', {
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: 'ok' }], is_error: false },
        { type: 'text', text: '<system-reminder>shh</system-reminder>' }
      ]
    })
    expect(events).toEqual([{ type: 'tool-result', toolUseId: 'toolu_1', isError: false, text: 'ok' }])
  })

  it('accepts plain string user content', () => {
    expect(translateMessage('user', 'u3', { content: 'hello' })).toEqual([{ type: 'user', id: 'u3:0', text: 'hello' }])
  })
})

describe('toolResultText', () => {
  it('flattens blocks and marks images', () => {
    expect(toolResultText([{ type: 'text', text: 'a' }, { type: 'image' }])).toBe('a\n[image]')
  })
})
