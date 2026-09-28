import type { Project, Settings } from './settings'

/**
 * Every request/response call the renderer can make. Main registers a handler
 * for each key, preload forwards them, and both sides share these types so a
 * renamed field breaks the build instead of the app.
 */
export interface InvokeMap {
  'settings:get': { args: []; result: Settings }
  'settings:set': { args: [patch: Partial<Settings>]; result: Settings }
  'projects:pick': { args: []; result: Project | null }
  'projects:branch': { args: [path: string]; result: string | null }
}

/** Fire-and-forget messages from renderer to main. */
export interface SendMap {
  'window:minimize': []
}

/** Pushes from main to renderer. */
export interface EventMap {
  'settings:changed': Settings
}

// Runtime allowlists. Typed as Record<keyof Map, true> so a missing key fails to compile.
export const INVOKE_CHANNELS: Record<keyof InvokeMap, true> = {
  'settings:get': true,
  'settings:set': true,
  'projects:pick': true,
  'projects:branch': true
}

export const SEND_CHANNELS: Record<keyof SendMap, true> = {
  'window:minimize': true
}

export const EVENT_CHANNELS: Record<keyof EventMap, true> = {
  'settings:changed': true
}

export type Unsubscribe = () => void

export interface WraithBridge {
  platform: 'darwin' | 'win32' | 'linux'
  invoke<K extends keyof InvokeMap>(channel: K, ...args: InvokeMap[K]['args']): Promise<InvokeMap[K]['result']>
  send<K extends keyof SendMap>(channel: K, ...args: SendMap[K]): void
  on<K extends keyof EventMap>(channel: K, listener: (payload: EventMap[K]) => void): Unsubscribe
}
