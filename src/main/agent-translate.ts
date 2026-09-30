import type { AgentEvent } from '@shared/agent'

type Block = Record<string, unknown> & { type?: string }

function asBlocks(content: unknown): Block[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return Array.isArray(content) ? (content as Block[]) : []
}

/** tool_result content can be a string or a list of text/image blocks. */
export function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content
  return asBlocks(content)
    .map((b) => (b.type === 'text' && typeof b.text === 'string' ? b.text : b.type === 'image' ? '[image]' : ''))
    .filter(Boolean)
    .join('\n')
}

/**
 * Converts one assistant or user message (live SDK message or a transcript
 * entry from getSessionMessages) into UI events. Unknown block types are dropped.
 */
export function translateMessage(
  role: 'user' | 'assistant',
  uuid: string,
  message: unknown
): AgentEvent[] {
  const m = (message ?? {}) as { content?: unknown }
  const blocks = asBlocks(m.content)
  const out: AgentEvent[] = []

  blocks.forEach((b, i) => {
    const id = `${uuid}:${i}`
    if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
      if (role === 'assistant') out.push({ type: 'text', id, text: b.text })
      else if (!isSyntheticUserText(b.text)) out.push({ type: 'user', id, text: b.text })
    } else if (b.type === 'tool_use' && role === 'assistant') {
      out.push({
        type: 'tool',
        id: String(b.id ?? id),
        name: String(b.name ?? 'Tool'),
        input: (b.input as Record<string, unknown>) ?? {}
      })
    } else if (b.type === 'tool_result') {
      out.push({
        type: 'tool-result',
        toolUseId: String(b.tool_use_id ?? ''),
        isError: b.is_error === true,
        text: toolResultText(b.content)
      })
    }
  })
  return out
}

/** Claude Code injects reminders and command wrappers as user text. Hide them. */
function isSyntheticUserText(text: string): boolean {
  const t = text.trimStart()
  return (
    t.startsWith('<system-reminder>') ||
    t.startsWith('<command-name>') ||
    t.startsWith('<local-command-stdout>') ||
    t.startsWith('<command-message>') ||
    t.startsWith('Caveat:')
  )
}
