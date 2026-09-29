import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import type { Theme, WraithPermissionMode } from '@shared/settings'
import { MONO, THEMES } from '../themes'

/**
 * Terminals outlive React. Switching tabs or flipping to UI mode detaches the
 * xterm element but keeps the instance (and its scrollback) alive, the same way
 * the pty keeps running in main.
 */
export interface TermEntry {
  id: string
  cwd: string
  term: Terminal
  fit: FitAddon
  element: HTMLDivElement
  status: 'idle' | 'starting' | 'running' | 'exited' | 'error'
  error?: string
  lastOutputAt: number
  opened: boolean
}

const entries = new Map<string, TermEntry>()
const listeners = new Set<() => void>()
let wired = false

function notify(): void {
  for (const l of listeners) l()
}

export function subscribeTerminals(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function xtermTheme(theme: Theme): ITheme {
  const t = THEMES[theme]
  const dark = theme === 'dark'
  return {
    background: t.term,
    foreground: t.fg,
    cursor: t.accent,
    cursorAccent: t.accentInk,
    selectionBackground: dark ? 'rgba(183,156,255,0.28)' : 'rgba(90,47,194,0.2)',
    black: dark ? '#1b1726' : '#1d1526',
    red: t.bad,
    green: t.ok,
    yellow: dark ? '#ffd27a' : '#8a5a00',
    blue: dark ? '#8fb4ff' : '#2f55b5',
    magenta: t.violet,
    cyan: dark ? '#7fdcdc' : '#14707a',
    white: dark ? '#d9d1e8' : '#5f5468',
    brightBlack: t.muted,
    brightRed: t.danger,
    brightGreen: dark ? '#a6f0c0' : '#2a8f58',
    brightYellow: t.accent,
    brightBlue: dark ? '#b3ccff' : '#3d6ad6',
    brightMagenta: dark ? '#d4c3ff' : '#7a4fe0',
    brightCyan: dark ? '#a8ecec' : '#1d8f9a',
    brightWhite: dark ? '#ffffff' : '#1d1526'
  }
}

function wireIpc(): void {
  if (wired) return
  wired = true
  window.wraith.on('pty:data', ({ id, data }) => {
    const e = entries.get(id)
    if (!e) return
    e.term.write(data)
    const wasQuiet = Date.now() - e.lastOutputAt > 1200
    e.lastOutputAt = Date.now()
    if (wasQuiet) notify()
  })
  window.wraith.on('pty:exit', ({ id, exitCode }) => {
    const e = entries.get(id)
    if (!e) return
    e.status = 'exited'
    e.term.write(`\r\n\x1b[2m[claude exited with code ${exitCode}. Press Enter to start a new session.]\x1b[0m\r\n`)
    notify()
  })
}

export function getTerminal(id: string): TermEntry | undefined {
  return entries.get(id)
}

export function ensureTerminal(id: string, cwd: string, theme: Theme): TermEntry {
  wireIpc()
  let e = entries.get(id)
  if (e) return e

  const term = new Terminal({
    fontFamily: MONO,
    fontSize: 14,
    lineHeight: 1.25,
    cursorBlink: true,
    cursorStyle: 'block',
    allowProposedApi: true,
    scrollback: 10000,
    macOptionIsMeta: true,
    theme: xtermTheme(theme)
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  const element = document.createElement('div')
  element.className = 'xterm-host'

  e = { id, cwd, term, fit, element, status: 'idle', lastOutputAt: 0, opened: false }
  const entry = e
  entries.set(id, entry)

  term.onData((data) => {
    if (entry.status === 'exited') {
      if (data === '\r') void startClaude(entry, currentPermissionMode)
      return
    }
    window.wraith.send('pty:write', id, data)
  })
  term.onResize(({ cols, rows }) => window.wraith.send('pty:resize', id, cols, rows))
  return entry
}

let currentPermissionMode: WraithPermissionMode = 'ask'

/** Attach the terminal to a host element. First attach opens xterm and spawns claude. */
export async function attachTerminal(
  entry: TermEntry,
  host: HTMLElement,
  permissionMode: WraithPermissionMode,
  beforeStart?: (entry: TermEntry) => void
): Promise<void> {
  currentPermissionMode = permissionMode
  host.appendChild(entry.element)
  if (!entry.opened) {
    await document.fonts.load(`14px 'JetBrains Mono'`).catch(() => undefined)
    entry.term.open(entry.element)
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      entry.term.loadAddon(webgl)
    } catch {
      // canvas fallback is fine
    }
    entry.opened = true
  }
  safeFit(entry)
  if (entry.status === 'idle') {
    beforeStart?.(entry)
    await startClaude(entry, permissionMode)
  }
  entry.term.focus()
}

export function safeFit(entry: TermEntry): void {
  if (!entry.element.isConnected || entry.element.clientWidth === 0) return
  try {
    entry.fit.fit()
  } catch {
    // xterm throws if measured before the renderer is ready
  }
}

async function startClaude(entry: TermEntry, permissionMode: WraithPermissionMode): Promise<void> {
  entry.status = 'starting'
  notify()
  const res = await window.wraith.invoke('pty:spawn', {
    id: entry.id,
    cwd: entry.cwd,
    cols: entry.term.cols,
    rows: entry.term.rows,
    permissionMode
  })
  if (res.ok) {
    entry.status = 'running'
    entry.error = undefined
  } else {
    entry.status = 'error'
    entry.error = res.error
    entry.term.write(`\x1b[31m${res.error}\x1b[0m\r\n`)
  }
  notify()
}

/** Kill and restart claude in place, e.g. after the permission mode changes. */
export async function restartTerminal(id: string, permissionMode: WraithPermissionMode): Promise<void> {
  const e = entries.get(id)
  if (!e) return
  window.wraith.send('pty:kill', id)
  e.term.reset()
  await startClaude(e, permissionMode)
}

export function disposeTerminal(id: string): void {
  const e = entries.get(id)
  if (!e) return
  window.wraith.send('pty:kill', id)
  e.term.dispose()
  e.element.remove()
  entries.delete(id)
  notify()
}

export function applyTerminalTheme(theme: Theme): void {
  for (const e of entries.values()) e.term.options.theme = xtermTheme(theme)
}

export function allTerminals(): TermEntry[] {
  return [...entries.values()]
}
