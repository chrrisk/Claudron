import { create } from 'zustand'
import type { AgentEvent, PermissionDecision, PermissionRequest, SessionSummary } from '@shared/agent'
import type { Project, ClaudronPermissionMode } from '@shared/settings'

export type ConvItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'text'; id: string; text: string }
  | {
      kind: 'tool'
      id: string
      name: string
      input: Record<string, unknown>
      result?: { isError: boolean; text: string }
    }
  | { kind: 'error'; id: string; text: string }

export interface Conversation {
  items: ConvItem[]
  permissions: PermissionRequest[]
  busy: boolean
  /** When the current turn started, for the "running 2m" label. */
  turnStartedAt: number | null
  sessionId: string | null
  title: string | null
  model: string | null
  contextPct: number | null
  opened: boolean
  history: SessionSummary[]
  /** Slash commands reported by Claude Code at session init. */
  commands: string[]
}

export interface FinishedTask {
  key: string
  title: string
  durationMs: number
  ok: boolean
  at: number
}

const empty = (): Conversation => ({
  items: [],
  permissions: [],
  busy: false,
  turnStartedAt: null,
  sessionId: null,
  title: null,
  model: null,
  contextPct: null,
  opened: false,
  history: [],
  commands: []
})

interface AgentState {
  convs: Record<string, Conversation>
  lastFinished: FinishedTask | null
  lastPermissionAt: number
}

export const useAgent = create<AgentState>(() => ({ convs: {}, lastFinished: null, lastPermissionAt: 0 }))

function patch(key: string, fn: (c: Conversation) => Partial<Conversation>): void {
  useAgent.setState((s) => {
    const c = s.convs[key] ?? empty()
    return { convs: { ...s.convs, [key]: { ...c, ...fn(c) } } }
  })
}

export function conversation(key: string): Conversation {
  return useAgent.getState().convs[key] ?? empty()
}

/** Applies one event to a list of items. Shared by live events and history replay. */
function reduceItems(items: ConvItem[], e: AgentEvent): ConvItem[] {
  switch (e.type) {
    case 'user':
      return [...items, { kind: 'user', id: e.id, text: e.text }]
    case 'text':
      return [...items, { kind: 'text', id: e.id, text: e.text }]
    case 'tool':
      return [...items, { kind: 'tool', id: e.id, name: e.name, input: e.input }]
    case 'tool-result':
      return items.map((it) =>
        it.kind === 'tool' && it.id === e.toolUseId ? { ...it, result: { isError: e.isError, text: e.text } } : it
      )
    case 'error':
      return [...items, { kind: 'error', id: `err-${Date.now()}`, text: e.message }]
    default:
      return items
  }
}

let wired = false
export function wireAgentEvents(): void {
  if (wired) return
  wired = true
  window.claudron.on('agent:event', ({ key, event }) => {
    switch (event.type) {
      case 'init':
        patch(key, () => ({ sessionId: event.sessionId, model: event.model, commands: event.commands }))
        return
      case 'busy':
        patch(key, (c) => ({ busy: event.busy, turnStartedAt: event.busy ? (c.turnStartedAt ?? Date.now()) : null }))
        return
      case 'permission':
        patch(key, (c) => ({ permissions: [...c.permissions, event.request] }))
        useAgent.setState({ lastPermissionAt: Date.now() })
        return
      case 'permission-cleared':
        patch(key, (c) => ({ permissions: c.permissions.filter((p) => p.requestId !== event.requestId) }))
        return
      case 'context':
        patch(key, () => ({ contextPct: event.percent }))
        return
      case 'result': {
        const c = conversation(key)
        const started = c.turnStartedAt
        patch(key, (cc) => ({
          busy: false,
          turnStartedAt: null,
          items: event.ok || !event.error ? cc.items : reduceItems(cc.items, { type: 'error', message: event.error })
        }))
        useAgent.setState({
          lastFinished: {
            key,
            title: c.title ?? 'Task',
            durationMs: started ? Date.now() - started : event.durationMs,
            ok: event.ok,
            at: Date.now()
          }
        })
        return
      }
      case 'closed':
        patch(key, () => ({ busy: false, turnStartedAt: null, permissions: [] }))
        return
      default:
        patch(key, (c) => ({ items: reduceItems(c.items, event) }))
    }
  })
}

export async function ensureSession(project: Project, permissionMode: ClaudronPermissionMode): Promise<void> {
  wireAgentEvents()
  if (conversation(project.id).opened) return
  patch(project.id, () => ({ opened: true }))
  await window.claudron.invoke('agent:open', { key: project.id, cwd: project.path, permissionMode })
  void refreshHistory(project)
}

export async function refreshHistory(project: Project): Promise<void> {
  const history = await window.claudron.invoke('agent:sessions', project.path)
  patch(project.id, () => ({ history }))
}

export async function sendPrompt(project: Project, text: string, permissionMode: ClaudronPermissionMode): Promise<void> {
  await ensureSession(project, permissionMode)
  const id = `local-${Date.now()}`
  patch(project.id, (c) => ({
    items: [...c.items, { kind: 'user', id, text }],
    title: c.title ?? text.split('\n')[0].slice(0, 60),
    busy: true,
    turnStartedAt: Date.now()
  }))
  try {
    await window.claudron.invoke('agent:send', project.id, text)
  } catch (err) {
    patch(project.id, (c) => ({
      busy: false,
      items: reduceItems(c.items, { type: 'error', message: (err as Error).message })
    }))
  }
}

export function respond(key: string, requestId: string, decision: PermissionDecision): void {
  patch(key, (c) => ({ permissions: c.permissions.filter((p) => p.requestId !== requestId) }))
  void window.claudron.invoke('agent:respond', key, requestId, decision)
}

export function interrupt(key: string): void {
  void window.claudron.invoke('agent:interrupt', key)
}

/** Starts a blank conversation, or resumes an old one when `resume` is given. */
export async function switchSession(
  project: Project,
  permissionMode: ClaudronPermissionMode,
  resume?: SessionSummary
): Promise<void> {
  wireAgentEvents()
  const prev = conversation(project.id)
  useAgent.setState((s) => ({
    convs: {
      ...s.convs,
      [project.id]: {
        ...empty(),
        opened: true,
        history: prev.history,
        sessionId: resume?.sessionId ?? null,
        title: resume?.title ?? null
      }
    }
  }))
  await window.claudron.invoke('agent:open', {
    key: project.id,
    cwd: project.path,
    permissionMode,
    resume: resume?.sessionId
  })
  if (resume) {
    const events = await window.claudron.invoke('agent:history', resume.sessionId, project.path)
    // A tool with no result in the transcript never finished (app quit, interrupt).
    const items = events.reduce(reduceItems, [] as ConvItem[]).map((it) =>
      it.kind === 'tool' && !it.result ? { ...it, result: { isError: true, text: 'Interrupted' } } : it
    )
    patch(project.id, () => ({ items }))
  }
  void refreshHistory(project)
}
