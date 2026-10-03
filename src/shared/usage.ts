/**
 * The cauldron only ever shows plan-limit percentages that Claude Code or
 * Anthropic reported. Nothing here computes, interpolates or guesses.
 */
export type UsageSource = 'sdk-event' | 'sdk-usage' | 'statusline'

export interface UsageReading {
  /** 0-100, exactly as reported (after unit conversion). */
  percent: number
  /** Epoch ms when the window resets, if reported. */
  resetsAt: number | null
  /** Epoch ms when Wraith received the reading. */
  observedAt: number
  source: UsageSource
}

export interface UsageSnapshot {
  session: UsageReading | null
  weekly: UsageReading | null
  /** False when the account has no plan limits (API key, Bedrock, Vertex). */
  plansApply: boolean | null
}

/** Older than this and the cauldron shows NO READING rather than a stale number. */
export const STALE_AFTER_MS = 10 * 60 * 1000

export function isFresh(r: UsageReading | null, now = Date.now()): r is UsageReading {
  return r !== null && now - r.observedAt <= STALE_AFTER_MS
}

export type Mood = 'CALM' | 'SIMMERING' | 'BOILING' | 'BOILING OVER' | 'NO READING'

export function moodFor(percent: number | null): Mood {
  if (percent === null) return 'NO READING'
  if (percent >= 92) return 'BOILING OVER'
  if (percent >= 75) return 'BOILING'
  if (percent >= 40) return 'SIMMERING'
  return 'CALM'
}

export function bubblesFor(mood: Mood): number {
  return mood === 'NO READING' ? 0 : mood === 'CALM' ? 1 : mood === 'SIMMERING' ? 3 : 5
}

/** `██████░░░░` for the CLI status line, or null for NO READING. */
export function bar(percent: number | null, width = 10): string | null {
  if (percent === null) return null
  const filled = Math.max(0, Math.min(width, Math.round(percent / (100 / width))))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/** Converts each source's units. Rate-limit headers report a 0-1 fraction. */
export function normalizePercent(value: number, source: UsageSource): number {
  const pct = source === 'sdk-event' ? value * 100 : value
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10))
}

/** Unix seconds (statusline, headers) or ISO strings (usage endpoint) to epoch ms. */
export function toEpochMs(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

export function formatReset(at: number | null, now = Date.now()): string | null {
  if (at === null) return null
  const ms = at - now
  if (ms <= 0) return 'resetting now'
  const mins = Math.round(ms / 60000)
  if (mins < 60 * 24) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h ? `resets in ${h}h ${m}m` : `resets in ${m}m`
  }
  const d = new Date(at)
  return `resets ${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export function formatAge(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'just now'
  return `${Math.round(s / 60)}m ago`
}
