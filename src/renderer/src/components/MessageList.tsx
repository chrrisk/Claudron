import { useEffect, useRef } from 'react'
import type { Project } from '@shared/settings'
import { respond, useAgent } from '../store/agent'
import { useHaunt } from '../lib/haunt'
import { Markdown } from './Markdown'
import { PermissionCard } from './PermissionCard'
import { ToolCard } from './ToolCard'

function AssistantAvatar(): React.JSX.Element {
  return (
    <div className="avatar" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" stroke="var(--accent)" strokeWidth="2" />
      </svg>
    </div>
  )
}

export function MessageList({ project }: { project: Project }): React.JSX.Element {
  const conv = useAgent((s) => s.convs[project.id])
  const { copy } = useHaunt()
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  const items = conv?.items ?? []
  const permissions = conv?.permissions ?? []

  // Stick to the bottom unless the user scrolled up to read.
  useEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [items.length, permissions.length, items[items.length - 1]])

  const onScroll = (): void => {
    const el = scroller.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  // Group consecutive assistant output (text + tools) under one avatar.
  const groups: { role: 'user' | 'assistant'; items: typeof items }[] = []
  for (const it of items) {
    const role = it.kind === 'user' ? 'user' : 'assistant'
    const last = groups[groups.length - 1]
    if (last && last.role === role && role === 'assistant') last.items.push(it)
    else groups.push({ role, items: [it] })
  }
  const lastAssistant = groups.length > 0 && groups[groups.length - 1].role === 'assistant'

  const permissionCards = permissions.map((p, i) => (
    <PermissionCard
      key={p.requestId}
      request={p}
      cwd={project.path}
      active={i === 0}
      onDecide={(d) => respond(project.id, p.requestId, d)}
    />
  ))

  return (
    <div className="messages" ref={scroller} onScroll={onScroll} aria-live="polite">
      {groups.map((g, gi) =>
        g.role === 'user' ? (
          <div key={g.items[0].id} className="bubble-user">
            {g.items[0].kind === 'user' ? g.items[0].text : null}
          </div>
        ) : (
          <div key={g.items[0].id} className="assistant-row">
            <AssistantAvatar />
            <div className="assistant-body">
              {g.items.map((it) => {
                if (it.kind === 'text') return <Markdown key={it.id} text={it.text} />
                if (it.kind === 'tool')
                  return (
                    <ToolCard
                      key={it.id}
                      item={it}
                      cwd={project.path}
                      waiting={permissions.some((p) => p.requestId === it.id)}
                    />
                  )
                if (it.kind === 'error')
                  return (
                    <div key={it.id} className="error-line" data-anim="glitch">
                      ✗ {copy.errorPrefix} {it.text}
                    </div>
                  )
                return null
              })}
              {gi === groups.length - 1 && permissionCards}
            </div>
          </div>
        )
      )}
      {!lastAssistant && permissions.length > 0 && (
        <div className="assistant-row">
          <AssistantAvatar />
          <div className="assistant-body">{permissionCards}</div>
        </div>
      )}
    </div>
  )
}
