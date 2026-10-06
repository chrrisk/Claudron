import { create } from 'zustand'

export interface CliState {
  model: string | null
  contextPct: number | null
  /** Between a UserPromptSubmit hook and the matching Stop hook. */
  busy: boolean
  /** A permission prompt is showing in the terminal. */
  waiting: boolean
  turnStartedAt: number | null
}

const blank: CliState = { model: null, contextPct: null, busy: false, waiting: false, turnStartedAt: null }

interface Store {
  sessions: Record<string, CliState>
  /** Bumped on hook events so sound effects can react. */
  lastPermissionAt: number
  lastStopAt: number
}

export const useCli = create<Store>(() => ({ sessions: {}, lastPermissionAt: 0, lastStopAt: 0 }))

function patch(id: string, p: Partial<CliState>): void {
  useCli.setState((s) => ({ sessions: { ...s.sessions, [id]: { ...blank, ...s.sessions[id], ...p } } }))
}

export function wireCliEvents(): void {
  window.claudron.on('cli:status', ({ id, model, contextPct }) => patch(id, { model, contextPct }))
  window.claudron.on('cli:event', ({ id, kind, at }) => {
    const cur = useCli.getState().sessions[id] ?? blank
    switch (kind) {
      case 'prompt':
        patch(id, { busy: true, waiting: false, turnStartedAt: cur.turnStartedAt ?? at })
        return
      case 'permission':
        patch(id, { waiting: true })
        useCli.setState({ lastPermissionAt: Date.now() })
        return
      case 'tool-done':
        patch(id, { waiting: false })
        return
      case 'stop':
        patch(id, { busy: false, waiting: false, turnStartedAt: null })
        useCli.setState({ lastStopAt: Date.now() })
        return
    }
  })
}

export function cliState(id: string): CliState {
  return useCli.getState().sessions[id] ?? blank
}
