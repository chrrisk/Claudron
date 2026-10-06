import type { ClaudronPermissionMode } from './settings'

/**
 * The renderer never sees raw SDK messages. Main flattens them into this small
 * event vocabulary so the UI only has to know about things it actually draws.
 */
export type AgentEvent =
  | { type: 'init'; sessionId: string; model: string; cwd: string; permissionMode: string; commands: string[] }
  | { type: 'user'; id: string; text: string }
  | { type: 'text'; id: string; text: string }
  | { type: 'tool'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool-result'; toolUseId: string; isError: boolean; text: string }
  | { type: 'permission'; request: PermissionRequest }
  | { type: 'permission-cleared'; requestId: string }
  | { type: 'busy'; busy: boolean }
  | { type: 'result'; ok: boolean; durationMs: number; costUsd: number | null; error?: string }
  | { type: 'context'; percent: number }
  | { type: 'error'; message: string }
  | { type: 'closed' }

export interface PermissionRequest {
  requestId: string
  toolName: string
  input: Record<string, unknown>
  /** Full sentence from Claude Code, when it provides one. */
  title?: string
  description?: string
  decisionReason?: string
  /** Claude Code asks that this prompt never be approved by a single keystroke. */
  defaultToNo?: boolean
  /** Whether an "always allow" rule is on offer. */
  canAlwaysAllow: boolean
}

export type PermissionDecision = 'once' | 'always' | 'deny'

export interface AgentEnvelope {
  /** Project id the session belongs to. */
  key: string
  event: AgentEvent
}

export interface AgentStartOptions {
  key: string
  cwd: string
  permissionMode: ClaudronPermissionMode
  /** Session id to resume, if continuing an old conversation. */
  resume?: string
}

export interface SessionSummary {
  sessionId: string
  title: string
  lastModified: number
  gitBranch?: string
}
