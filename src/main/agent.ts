import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type {
  CanUseTool,
  PermissionMode,
  PermissionResult,
  PermissionUpdate,
  Query,
  SDKMessage,
  SDKRateLimitInfo,
  SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type {
  AgentEvent,
  AgentStartOptions,
  PermissionDecision,
  PermissionRequest,
  SessionSummary
} from '@shared/agent'
import type { WraithPermissionMode } from '@shared/settings'
import { translateMessage } from './agent-translate'
import { bundledClaude } from './claude-path'
import { broadcast } from './ipc'
import { childEnv } from './pty'
import { loadShellEnv } from './shell-env'

type Sdk = typeof import('@anthropic-ai/claude-agent-sdk')
let sdkPromise: Promise<Sdk> | null = null
/** The SDK is ESM only; load it lazily from the CJS main bundle. */
export function loadSdk(): Promise<Sdk> {
  sdkPromise ??= import('@anthropic-ai/claude-agent-sdk')
  return sdkPromise
}

/** Lets other main modules (usage) observe SDK traffic without coupling to sessions. */
export const agentBus = new EventEmitter<{
  rateLimit: [info: SDKRateLimitInfo]
  query: [q: Query]
  turnEnd: []
}>()

export function sdkPermissionMode(mode: WraithPermissionMode): PermissionMode {
  switch (mode) {
    case 'acceptEdits':
      return 'acceptEdits'
    case 'plan':
      return 'plan'
    case 'unleashed':
      return 'bypassPermissions'
    default:
      return 'default'
  }
}

/** Minimal async queue feeding user turns into a streaming-input query. */
class Inbox implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = []
  private waiters: ((r: IteratorResult<SDKUserMessage>) => void)[] = []
  private done = false

  push(msg: SDKUserMessage): void {
    const w = this.waiters.shift()
    if (w) w({ value: msg, done: false })
    else this.items.push(msg)
  }

  close(): void {
    this.done = true
    for (const w of this.waiters.splice(0)) w({ value: undefined, done: true })
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: () => {
        const item = this.items.shift()
        if (item) return Promise.resolve({ value: item, done: false })
        if (this.done) return Promise.resolve({ value: undefined, done: true })
        return new Promise((resolve) => this.waiters.push(resolve))
      }
    }
  }
}

interface Pending {
  resolve: (r: PermissionResult) => void
  input: Record<string, unknown>
  suggestions?: PermissionUpdate[]
}

class AgentSession {
  private q: Query | null = null
  private inbox = new Inbox()
  private pending = new Map<string, Pending>()
  private sessionId: string | null = null
  private busy = false
  private closed = false

  constructor(
    readonly key: string,
    private opts: AgentStartOptions
  ) {}

  private emit(event: AgentEvent): void {
    broadcast('agent:event', { key: this.key, event })
  }

  private setBusy(busy: boolean): void {
    if (this.busy === busy) return
    this.busy = busy
    this.emit({ type: 'busy', busy })
  }

  private canUseTool: CanUseTool = (toolName, input, options) =>
    new Promise<PermissionResult>((resolve) => {
      const requestId = options.toolUseID || randomUUID()
      const request: PermissionRequest = {
        requestId,
        toolName,
        input,
        title: options.title,
        description: options.description,
        decisionReason: options.decisionReason,
        defaultToNo: options.defaultToNo,
        canAlwaysAllow: (options.suggestions?.length ?? 0) > 0
      }
      this.pending.set(requestId, { resolve, input, suggestions: options.suggestions })
      permissionEvents.emit('waiting', this.pending.size > 0 || anyPending())
      this.emit({ type: 'permission', request })

      options.signal.addEventListener('abort', () => {
        if (!this.pending.delete(requestId)) return
        resolve({ behavior: 'deny', message: 'Request was cancelled.' })
        this.emit({ type: 'permission-cleared', requestId })
        permissionEvents.emit('waiting', anyPending())
      })
    })

  hasPending(): boolean {
    return this.pending.size > 0
  }

  private async start(): Promise<Query> {
    if (this.q) return this.q
    await loadShellEnv()
    const { query } = await loadSdk()
    const mode = this.opts.permissionMode
    const q = query({
      prompt: this.inbox,
      options: {
        cwd: this.opts.cwd,
        resume: this.opts.resume,
        permissionMode: sdkPermissionMode(mode),
        allowDangerouslySkipPermissions: mode === 'unleashed',
        canUseTool: this.canUseTool,
        // The UI has no question form yet; Claude asks in plain text instead.
        disallowedTools: ['AskUserQuestion'],
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        pathToClaudeCodeExecutable: bundledClaude() ?? undefined,
        env: childEnv(),
        stderr: (data) => {
          if (/error/i.test(data)) console.error('[agent]', data.trim())
        }
      }
    })
    this.q = q
    agentBus.emit('query', q)
    void this.pump(q)
    return q
  }

  private async pump(q: Query): Promise<void> {
    try {
      for await (const msg of q) this.handle(msg)
    } catch (err) {
      if (!this.closed) this.emit({ type: 'error', message: (err as Error).message })
    } finally {
      this.setBusy(false)
      if (this.q === q) this.q = null
      if (!this.closed) {
        // Process ended (crash or exit). Next send() starts a fresh one resuming this session.
        this.inbox = new Inbox()
        if (this.sessionId) this.opts = { ...this.opts, resume: this.sessionId }
      }
      this.emit({ type: 'closed' })
    }
  }

  private handle(msg: SDKMessage): void {
    switch (msg.type) {
      case 'system':
        if (msg.subtype === 'init') {
          this.sessionId = msg.session_id
          this.emit({
            type: 'init',
            sessionId: msg.session_id,
            model: msg.model,
            cwd: msg.cwd,
            permissionMode: msg.permissionMode
          })
        }
        return
      case 'assistant':
        if (msg.parent_tool_use_id) return // subagent chatter stays folded inside its Task card
        for (const e of translateMessage('assistant', msg.uuid, msg.message)) this.emit(e)
        return
      case 'user':
        if (msg.parent_tool_use_id) return
        for (const e of translateMessage('user', msg.uuid ?? randomUUID(), msg.message)) {
          // Our own prompt is drawn optimistically by the renderer.
          if (e.type !== 'user') this.emit(e)
        }
        return
      case 'result': {
        this.setBusy(false)
        const ok = msg.subtype === 'success' && !msg.is_error
        this.emit({
          type: 'result',
          ok,
          durationMs: msg.duration_ms,
          costUsd: typeof msg.total_cost_usd === 'number' ? msg.total_cost_usd : null,
          error: ok ? undefined : 'errors' in msg && msg.errors?.length ? msg.errors.join('\n') : undefined
        })
        void this.refreshContext()
        agentBus.emit('turnEnd')
        return
      }
      case 'rate_limit_event':
        agentBus.emit('rateLimit', msg.rate_limit_info)
        return
      default:
        return
    }
  }

  private async refreshContext(): Promise<void> {
    try {
      const usage = await this.q?.getContextUsage({ detail: 'summary' })
      if (usage && Number.isFinite(usage.percentage)) {
        this.emit({ type: 'context', percent: Math.round(usage.percentage) })
      }
    } catch {
      // older CLI or process gone; the strip just keeps its last value
    }
  }

  async send(text: string): Promise<void> {
    await this.start()
    this.setBusy(true)
    this.inbox.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null
    } as SDKUserMessage)
  }

  async interrupt(): Promise<void> {
    for (const [id, p] of this.pending) {
      p.resolve({ behavior: 'deny', message: 'Interrupted by user.', interrupt: true })
      this.emit({ type: 'permission-cleared', requestId: id })
    }
    this.pending.clear()
    permissionEvents.emit('waiting', anyPending())
    await this.q?.interrupt().catch(() => undefined)
  }

  async setPermissionMode(mode: WraithPermissionMode): Promise<void> {
    this.opts = { ...this.opts, permissionMode: mode }
    if (!this.q) return
    if (mode === 'unleashed') {
      // bypassPermissions must be allowed at launch, so restart the process on the same session.
      await this.restart()
      return
    }
    await this.q.setPermissionMode(sdkPermissionMode(mode)).catch(() => undefined)
  }

  private async restart(): Promise<void> {
    const q = this.q
    if (!q) return
    if (this.sessionId) this.opts = { ...this.opts, resume: this.sessionId }
    this.inbox.close()
    q.close()
  }

  respond(requestId: string, decision: PermissionDecision): void {
    const p = this.pending.get(requestId)
    if (!p) return
    this.pending.delete(requestId)
    if (decision === 'deny') {
      p.resolve({ behavior: 'deny', message: 'The user declined this action.' })
    } else {
      p.resolve({
        behavior: 'allow',
        updatedInput: p.input,
        updatedPermissions: decision === 'always' ? p.suggestions : undefined
      })
    }
    this.emit({ type: 'permission-cleared', requestId })
    permissionEvents.emit('waiting', anyPending())
  }

  close(): void {
    this.closed = true
    for (const p of this.pending.values()) p.resolve({ behavior: 'deny', message: 'Session closed.' })
    this.pending.clear()
    this.inbox.close()
    this.q?.close()
    this.q = null
  }
}

const sessions = new Map<string, AgentSession>()

/** Fires whenever "is any permission prompt waiting" may have changed. Spotify ducking listens. */
export const permissionEvents = new EventEmitter<{ waiting: [waiting: boolean] }>()
function anyPending(): boolean {
  for (const s of sessions.values()) if (s.hasPending()) return true
  return false
}

/** (Re)opens the session for a project. Passing `resume` switches conversations. */
export function openSession(opts: AgentStartOptions): void {
  sessions.get(opts.key)?.close()
  sessions.set(opts.key, new AgentSession(opts.key, opts))
}

function sessionFor(key: string): AgentSession {
  const s = sessions.get(key)
  if (!s) throw new Error(`No agent session for ${key}`)
  return s
}

export const agent = {
  send: (key: string, text: string) => sessionFor(key).send(text),
  interrupt: (key: string) => sessionFor(key).interrupt(),
  respond: (key: string, requestId: string, decision: PermissionDecision) =>
    sessionFor(key).respond(requestId, decision),
  setPermissionMode: async (mode: WraithPermissionMode) => {
    await Promise.all([...sessions.values()].map((s) => s.setPermissionMode(mode)))
  },
  close: (key: string) => {
    sessions.get(key)?.close()
    sessions.delete(key)
  },
  closeAll: () => {
    for (const s of sessions.values()) s.close()
    sessions.clear()
  }
}

export async function listProjectSessions(cwd: string): Promise<SessionSummary[]> {
  try {
    const { listSessions } = await loadSdk()
    const list = await listSessions({ dir: cwd, limit: 12 })
    return list.map((s) => ({
      sessionId: s.sessionId,
      title: s.customTitle || s.summary || s.firstPrompt || 'Untitled session',
      lastModified: s.lastModified,
      gitBranch: s.gitBranch
    }))
  } catch {
    return []
  }
}

export async function loadHistory(sessionId: string, cwd: string): Promise<AgentEvent[]> {
  try {
    const { getSessionMessages } = await loadSdk()
    const msgs = await getSessionMessages(sessionId, { dir: cwd })
    return msgs
      .filter((m) => m.parent_tool_use_id === null && (m.type === 'user' || m.type === 'assistant'))
      .flatMap((m) => translateMessage(m.type as 'user' | 'assistant', m.uuid, m.message))
  } catch {
    return []
  }
}
