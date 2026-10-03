import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import type { Query, SDKRateLimitInfo, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import {
  normalizePercent,
  toEpochMs,
  type UsageReading,
  type UsageSnapshot,
  type UsageSource
} from '@shared/usage'
import { agentBus, loadSdk } from './agent'
import { bundledClaude } from './claude-path'
import { broadcast } from './ipc'
import { addPtyArgs, childEnv } from './pty'
import { loadShellEnv } from './shell-env'

// ---------------------------------------------------------------------------
// Hub: newest real reading per window wins. Nothing is ever derived.

const snapshot: UsageSnapshot = { session: null, weekly: null, plansApply: null }

function record(window: 'session' | 'weekly', value: number | null | undefined, resets: number | string | null | undefined, source: UsageSource): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) return
  const reading: UsageReading = {
    percent: normalizePercent(value, source),
    resetsAt: toEpochMs(resets),
    observedAt: Date.now(),
    source
  }
  snapshot[window] = reading
  snapshot.plansApply = true
  broadcast('usage:changed', { ...snapshot })
}

export function getUsage(): UsageSnapshot {
  return { ...snapshot }
}

// ---------------------------------------------------------------------------
// Source 1: rate_limit_event from UI-mode sessions. Utilization is a 0-1 fraction.

agentBus.on('rateLimit', (info: SDKRateLimitInfo) => {
  if (info.rateLimitType === 'five_hour') record('session', info.utilization, info.resetsAt, 'sdk-event')
  else if (info.rateLimitType === 'seven_day') record('weekly', info.utilization, info.resetsAt, 'sdk-event')
})

// ---------------------------------------------------------------------------
// Source 2: the /usage control request, on an idle probe process.
// This API is marked experimental in the SDK. If it disappears or throws, the
// cauldron simply falls back to the other sources or NO READING.

const PROBE_EVERY_MS = 3 * 60 * 1000
let probe: { q: Query; stop: () => void } | null = null
let probeBroken = false
let probeTimer: ReturnType<typeof setInterval> | null = null
let probing = false

async function startProbe(): Promise<Query> {
  if (probe) return probe.q
  await loadShellEnv()
  const { query } = await loadSdk()
  let release: () => void = () => undefined
  // An input stream that never yields: the process idles, answering control requests only.
  const idle: AsyncIterable<SDKUserMessage> = {
    [Symbol.asyncIterator]: () => ({
      next: () => new Promise<IteratorResult<SDKUserMessage>>((resolve) => (release = () => resolve({ value: undefined, done: true })))
    })
  }
  const q = query({
    prompt: idle,
    options: {
      cwd: homedir(),
      // No user/project settings: no hooks, no MCP servers, nothing to start up.
      settingSources: [],
      pathToClaudeCodeExecutable: bundledClaude() ?? undefined,
      env: childEnv()
    }
  })
  probe = {
    q,
    stop: () => {
      release()
      q.close()
    }
  }
  // Drain messages so the stream does not back up; we only care about control responses.
  void (async () => {
    try {
      for await (const _ of q) void _
    } catch {
      // ignore
    } finally {
      probe = null
    }
  })()
  return q
}

export async function refreshUsage(): Promise<void> {
  if (probeBroken || probing) return
  probing = true
  try {
    const q = await startProbe()
    const res = await q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true })
    if (!res.rate_limits_available || !res.rate_limits) {
      snapshot.plansApply = res.rate_limits_available ? snapshot.plansApply : false
      broadcast('usage:changed', { ...snapshot })
      return
    }
    const rl = res.rate_limits
    record('session', rl.five_hour?.utilization, rl.five_hour?.resets_at, 'sdk-usage')
    record('weekly', rl.seven_day?.utilization, rl.seven_day?.resets_at, 'sdk-usage')
  } catch (err) {
    const msg = (err as Error).message ?? ''
    // Unknown method on this CLI version: stop asking. Anything else, retry next tick.
    if (/not a function|unsupported|unknown (subtype|request)/i.test(msg)) {
      probeBroken = true
      probe?.stop()
    }
  } finally {
    probing = false
  }
}

export function startUsagePolling(): void {
  if (probeTimer) return
  void refreshUsage()
  probeTimer = setInterval(() => {
    if (BrowserWindow.getAllWindows().some((w) => w.isFocused())) void refreshUsage()
  }, PROBE_EVERY_MS)
  app.on('browser-window-focus', () => {
    const age = snapshot.session ? Date.now() - snapshot.session.observedAt : Infinity
    if (age > 60_000) void refreshUsage()
  })
  agentBus.on('turnEnd', () => void refreshUsage())
}

export function stopUsage(): void {
  if (probeTimer) clearInterval(probeTimer)
  probeTimer = null
  probe?.stop()
  if (tapTimer) clearInterval(tapTimer)
}

// ---------------------------------------------------------------------------
// Source 3: CLI mode. Each pty gets --settings with a status line command and a
// few hooks pointing at resources/wraith-tap.cjs, which drops what Claude Code
// hands it into a folder we poll.

const tapDir = (): string => join(app.getPath('userData'), 'tap')

function tapScript(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'wraith-tap.cjs')
    : join(app.getAppPath(), 'resources', 'wraith-tap.cjs')
}

/** Claude Code runs these through a POSIX shell (Git Bash on Windows), so forward slashes and env prefixes work everywhere. */
function posix(p: string): string {
  return p.replace(/\\/g, '/')
}

function tapCommand(...args: string[]): string {
  const q = (s: string): string => `"${posix(s)}"`
  return `ELECTRON_RUN_AS_NODE=1 ${q(process.execPath)} ${q(tapScript())} ${args.map(q).join(' ')}`
}

function userStatusLine(): string | null {
  try {
    const file = join(homedir(), '.claude', 'settings.json')
    if (!existsSync(file)) return null
    const cfg = JSON.parse(readFileSync(file, 'utf8')) as { statusLine?: { command?: string } }
    return cfg.statusLine?.command ?? null
  } catch {
    return null
  }
}

export function installCliTap(): void {
  void mkdir(tapDir(), { recursive: true })
  addPtyArgs((opts) => {
    const dir = tapDir()
    const hook = (kind: string): { hooks: { type: 'command'; command: string }[] } => ({
      hooks: [{ type: 'command', command: tapCommand('event', dir, opts.id, kind) }]
    })
    const settings = {
      statusLine: { type: 'command', command: tapCommand('statusline', dir, opts.id), padding: 0 },
      hooks: {
        Notification: [{ matcher: 'permission_prompt', ...hook('permission') }],
        PostToolUse: [hook('tool-done')],
        PermissionDenied: [hook('tool-done')],
        UserPromptSubmit: [hook('prompt')],
        Stop: [hook('stop')]
      }
    }
    return { args: ['--settings', JSON.stringify(settings)], env: userEnv() }
  })
  startTapPolling()
}

function userEnv(): Record<string, string> {
  const cmd = userStatusLine()
  return cmd ? { WRAITH_USER_STATUSLINE: cmd } : {}
}

let tapTimer: ReturnType<typeof setInterval> | null = null
const seenMtime = new Map<string, number>()
const eventOffsets = new Map<string, number>()

interface StatusJson {
  model?: { id?: string; display_name?: string }
  context_window?: { used_percentage?: number | null }
  rate_limits?: {
    five_hour?: { used_percentage?: number; resets_at?: number | string }
    seven_day?: { used_percentage?: number; resets_at?: number | string }
  }
}

async function pollTap(): Promise<void> {
  let files: string[]
  try {
    files = await readdir(tapDir())
  } catch {
    return
  }
  for (const f of files) {
    const full = join(tapDir(), f)
    try {
      if (f.endsWith('.status.json')) {
        const s = await stat(full)
        if (seenMtime.get(f) === s.mtimeMs) continue
        seenMtime.set(f, s.mtimeMs)
        const data = JSON.parse(await readFile(full, 'utf8')) as StatusJson
        const id = f.slice(0, -'.status.json'.length)
        broadcast('cli:status', {
          id,
          model: data.model?.display_name ?? data.model?.id ?? null,
          contextPct: typeof data.context_window?.used_percentage === 'number' ? Math.round(data.context_window.used_percentage) : null
        })
        const rl = data.rate_limits
        if (rl) {
          record('session', rl.five_hour?.used_percentage, rl.five_hour?.resets_at, 'statusline')
          record('weekly', rl.seven_day?.used_percentage, rl.seven_day?.resets_at, 'statusline')
        }
      } else if (f.endsWith('.events.jsonl')) {
        const s = await stat(full)
        const from = eventOffsets.get(f)
        eventOffsets.set(f, s.size)
        // First sighting: skip history from earlier runs.
        if (from === undefined || s.size <= from) continue
        const text = (await readFile(full, 'utf8')).slice(from)
        const id = f.slice(0, -'.events.jsonl'.length)
        for (const line of text.split('\n')) {
          if (!line.trim()) continue
          const ev = JSON.parse(line) as { kind: string; at: number }
          broadcast('cli:event', { id, kind: ev.kind, at: ev.at })
          cliEventListeners.forEach((l) => l(id, ev.kind))
        }
      }
    } catch {
      // half-written file; next tick
    }
  }
}

type CliEventListener = (id: string, kind: string) => void
const cliEventListeners = new Set<CliEventListener>()
export function onCliEvent(fn: CliEventListener): void {
  cliEventListeners.add(fn)
}

function startTapPolling(): void {
  if (tapTimer) return
  void pollTap()
  tapTimer = setInterval(() => void pollTap(), 1000)
}
