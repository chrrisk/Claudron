import type { WraithPermissionMode } from './settings'

export interface PtySpawnOptions {
  /** One pty per project tab, keyed by project id. */
  id: string
  cwd: string
  cols: number
  rows: number
  permissionMode: WraithPermissionMode
  /** Pass --continue to pick the most recent conversation back up. */
  continueSession?: boolean
}

export type PtySpawnResult =
  | { ok: true; pid: number; binary: string; reused: boolean }
  | { ok: false; error: string }

export interface PtyData {
  id: string
  data: string
}

export interface PtyExit {
  id: string
  exitCode: number
}

/** CLI flags for each Wraith permission mode. */
export function permissionFlags(mode: WraithPermissionMode): string[] {
  switch (mode) {
    case 'acceptEdits':
      return ['--permission-mode', 'acceptEdits']
    case 'plan':
      return ['--permission-mode', 'plan']
    case 'unleashed':
      return ['--dangerously-skip-permissions']
    default:
      // Explicit, because newer Claude Code versions default to auto mode.
      return ['--permission-mode', 'default']
  }
}
