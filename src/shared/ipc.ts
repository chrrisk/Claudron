import type { AgentEnvelope, AgentEvent, AgentStartOptions, PermissionDecision, SessionSummary } from './agent'
import type { PtyData, PtyExit, PtySpawnOptions, PtySpawnResult } from './pty'
import type { Project, Settings } from './settings'
import type { SpotifyCommand, SpotifyState } from './spotify'
import type { UsageSnapshot } from './usage'

/**
 * Every request/response call the renderer can make. Main registers a handler
 * for each key, preload forwards them, and both sides share these types so a
 * renamed field breaks the build instead of the app.
 */
export interface InvokeMap {
  'app:info': { args: []; result: { home: string; version: string } }
  'settings:get': { args: []; result: Settings }
  'settings:set': { args: [patch: Partial<Settings>]; result: Settings }
  'projects:pick': { args: []; result: Project | null }
  'projects:branch': { args: [path: string]; result: string | null }
  'claude:locate': { args: []; result: { path: string; source: string } | null }
  'pty:spawn': { args: [opts: PtySpawnOptions]; result: PtySpawnResult }
  'agent:open': { args: [opts: AgentStartOptions]; result: void }
  'agent:send': { args: [key: string, text: string]; result: void }
  'agent:interrupt': { args: [key: string]; result: void }
  'agent:respond': { args: [key: string, requestId: string, decision: PermissionDecision]; result: void }
  'agent:close': { args: [key: string]; result: void }
  'agent:sessions': { args: [cwd: string]; result: SessionSummary[] }
  'agent:history': { args: [sessionId: string, cwd: string]; result: AgentEvent[] }
  'usage:get': { args: []; result: UsageSnapshot }
  'usage:refresh': { args: []; result: void }
  'spotify:get': { args: []; result: SpotifyState }
  'spotify:connect': { args: []; result: void }
  'spotify:disconnect': { args: []; result: void }
  'spotify:command': { args: [cmd: SpotifyCommand]; result: void }
}

/** Fire-and-forget messages from renderer to main. */
export interface SendMap {
  'window:minimize': []
  'pty:write': [id: string, data: string]
  'pty:resize': [id: string, cols: number, rows: number]
  'pty:kill': [id: string]
}

/** Pushes from main to renderer. */
export interface EventMap {
  'settings:changed': Settings
  'pty:data': PtyData
  'pty:exit': PtyExit
  'agent:event': AgentEnvelope
  'usage:changed': UsageSnapshot
  /** What Claude Code's status line input says about a CLI session. */
  'cli:status': { id: string; model: string | null; contextPct: number | null }
  /** Hook events from a CLI session: permission, tool-done, prompt, stop. */
  'cli:event': { id: string; kind: string; at: number }
  'spotify:state': SpotifyState
}

// Runtime allowlists. Typed as Record<keyof Map, true> so a missing key fails to compile.
export const INVOKE_CHANNELS: Record<keyof InvokeMap, true> = {
  'app:info': true,
  'settings:get': true,
  'settings:set': true,
  'projects:pick': true,
  'projects:branch': true,
  'claude:locate': true,
  'pty:spawn': true,
  'agent:open': true,
  'agent:send': true,
  'agent:interrupt': true,
  'agent:respond': true,
  'agent:close': true,
  'agent:sessions': true,
  'agent:history': true,
  'usage:get': true,
  'usage:refresh': true,
  'spotify:get': true,
  'spotify:connect': true,
  'spotify:disconnect': true,
  'spotify:command': true
}

export const SEND_CHANNELS: Record<keyof SendMap, true> = {
  'window:minimize': true,
  'pty:write': true,
  'pty:resize': true,
  'pty:kill': true
}

export const EVENT_CHANNELS: Record<keyof EventMap, true> = {
  'settings:changed': true,
  'pty:data': true,
  'pty:exit': true,
  'agent:event': true,
  'usage:changed': true,
  'cli:status': true,
  'cli:event': true,
  'spotify:state': true
}

export type Unsubscribe = () => void

export interface WraithBridge {
  platform: 'darwin' | 'win32' | 'linux'
  invoke<K extends keyof InvokeMap>(channel: K, ...args: InvokeMap[K]['args']): Promise<InvokeMap[K]['result']>
  send<K extends keyof SendMap>(channel: K, ...args: SendMap[K]): void
  on<K extends keyof EventMap>(channel: K, listener: (payload: EventMap[K]) => void): Unsubscribe
}
