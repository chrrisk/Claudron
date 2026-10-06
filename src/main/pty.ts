import * as pty from 'node-pty'
import { permissionFlags, type PtySpawnOptions, type PtySpawnResult } from '@shared/pty'
import { findClaude, spawnTarget } from './claude-path'
import { broadcast } from './ipc'
import { composeNotes } from '@shared/notes'
import { loadShellEnv } from './shell-env'
import { sessionExists } from './agent'
import { getSettings } from './settings-store'
import { prepareSsh, type Launch } from './ssh-session'

interface Session {
  proc: pty.IPty
  /** Set when we killed it on purpose (restart, tab close), so no exit notice is sent. */
  killed?: boolean
  buffer: string
  flushQueued: boolean
  /** Runs once when the process ends (closes the secrets bridge for SSH sessions). */
  cleanup?: () => void
}

const sessions = new Map<string, Session>()

// Markers a parent Claude Code session leaves in the environment. If Claudron was
// launched from inside one, passing them on makes the child think it is nested.
const INHERITED_SESSION_VARS = ['CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT']

export function childEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !INHERITED_SESSION_VARS.includes(k)) env[k] = v
  }
  return { ...env, ...extra }
}

/** Extra CLI args and env contributed by other modules (the usage tap adds --settings). */
type ArgProvider = (opts: PtySpawnOptions) => { args: string[]; env?: Record<string, string> }
const argProviders: ArgProvider[] = []
export function addPtyArgs(provider: ArgProvider): void {
  argProviders.push(provider)
}

function flush(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  s.flushQueued = false
  if (!s.buffer) return
  const data = s.buffer
  s.buffer = ''
  broadcast('pty:data', { id, data })
}

export async function spawnPty(opts: PtySpawnOptions): Promise<PtySpawnResult> {
  const existing = sessions.get(opts.id)
  if (existing) {
    existing.proc.resize(Math.max(opts.cols, 2), Math.max(opts.rows, 2))
    return { ok: true, pid: existing.proc.pid, binary: existing.proc.process, reused: true }
  }

  await loadShellEnv()
  const launch = opts.ssh ? await prepareSsh(opts) : await prepareLocal(opts)
  if (!launch.ok) return launch

  let proc: pty.IPty
  try {
    proc = pty.spawn(launch.file, launch.args, {
      name: 'xterm-256color',
      cols: Math.max(opts.cols, 2),
      rows: Math.max(opts.rows, 2),
      cwd: launch.cwd,
      env: childEnv({ ...launch.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'claudron' }),
      useConpty: true
    })
  } catch (err) {
    launch.cleanup?.()
    return { ok: false, error: `Failed to start ${opts.ssh ? 'ssh' : 'claude'}: ${(err as Error).message}` }
  }

  const session: Session = { proc, buffer: '', flushQueued: false, cleanup: launch.cleanup }
  sessions.set(opts.id, session)

  // Batch bursts of output into one IPC message per tick.
  proc.onData((data) => {
    session.buffer += data
    if (!session.flushQueued) {
      session.flushQueued = true
      setTimeout(() => flush(opts.id), 4)
    }
  })

  proc.onExit(({ exitCode }) => {
    flush(opts.id)
    session.cleanup?.()
    if (sessions.get(opts.id)?.proc === proc) sessions.delete(opts.id)
    if (!session.killed) broadcast('pty:exit', { id: opts.id, exitCode })
  })

  return { ok: true, pid: proc.pid, binary: launch.binary, reused: false }
}

async function prepareLocal(opts: PtySpawnOptions): Promise<Launch> {
  const claude = findClaude()
  if (!claude) {
    return {
      ok: false,
      error: 'Could not find the claude binary. Install Claude Code (https://claude.com/claude-code) and restart Claudron.'
    }
  }
  const resumeFlags = opts.sessionId
    ? (await sessionExists(opts.cwd, opts.sessionId))
      ? ['--resume', opts.sessionId]
      : ['--session-id', opts.sessionId]
    : opts.continueSession
      ? ['--continue']
      : []
  const extras = argProviders.map((p) => p(opts))
  const args = [
    ...resumeFlags,
    ...permissionFlags(opts.permissionMode),
    ...(getSettings().model ? ['--model', getSettings().model] : []),
    ...composeNotes(getSettings().agentNote, []),
    ...extras.flatMap((e) => e.args)
  ]
  const env = Object.assign({}, ...extras.map((e) => e.env ?? {})) as Record<string, string>
  const target = spawnTarget(claude.path, args)
  return { ok: true, file: target.file, args: target.args, cwd: opts.cwd, env, binary: claude.path }
}

export function writePty(id: string, data: string): void {
  sessions.get(id)?.proc.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  const s = sessions.get(id)
  if (!s || cols < 2 || rows < 2) return
  try {
    s.proc.resize(cols, rows)
  } catch {
    // the process can exit between the check and the resize
  }
}

export function killPty(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  sessions.delete(id)
  s.killed = true
  try {
    s.proc.kill()
  } catch {
    // already gone
  }
}

export function killAllPtys(): void {
  for (const id of [...sessions.keys()]) killPty(id)
}
