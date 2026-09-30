import type { HauntLevel } from './settings'

/** Every string that changes with the haunt level. See the Copy table in docs/DESIGN_SPEC.md. */
export interface Copy {
  newSession: string
  placeholder: string
  permTag: string
  permLead: string
  cliPermLead: string
  allowOnce: string
  allowAlways: string
  deny: string
  working: readonly string[]
  errorPrefix: string
  endedTitle: (title: string) => string
  endedMeta: (ago: string) => string
}

const SPOOKY_VERBS = ['Brewing', 'Consulting the spirits', 'Rattling bones', 'Reading the bones'] as const

const plain: Copy = {
  newSession: 'New session',
  placeholder: 'Ask anything, or type / for commands',
  permTag: 'NEEDS YOU',
  permLead: 'Claude wants to run',
  cliPermLead: 'Run',
  allowOnce: 'Allow once',
  allowAlways: 'Always allow',
  deny: 'Deny',
  working: ['Working'],
  errorPrefix: 'Error:',
  endedTitle: (t) => t,
  endedMeta: (ago) => ago
}

const spooky: Copy = {
  newSession: 'Summon session',
  placeholder: 'Speak, mortal. Or type / for commands',
  permTag: 'AT THE DOOR',
  permLead: 'Claude is at the door and wants to run',
  cliPermLead: 'Claude is at the door. Invite it in to run',
  allowOnce: 'Invite in once',
  allowAlways: 'Always welcome',
  deny: 'Banish',
  working: SPOOKY_VERBS,
  errorPrefix: 'Something went bump in the night:',
  endedTitle: (t) => `RIP · ${t}`,
  endedMeta: (ago) => `laid to rest ${ago}`
}

export function copyFor(level: HauntLevel): Copy {
  return level === 'subtle' ? plain : spooky
}

export const MOON_FRAMES = ['◐', '◓', '◑', '◒'] as const

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s}s`
  const h = Math.floor(m / 60)
  if (h === 0) return `${m}m ${s}s`
  return `${h}h ${m % 60}m`
}
