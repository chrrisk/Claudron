import { describe, expect, it } from 'vitest'
import { bar, bubblesFor, isFresh, moodFor, normalizePercent, STALE_AFTER_MS, toEpochMs } from '../src/shared/usage'

describe('moodFor', () => {
  it('follows the spec ranges', () => {
    expect(moodFor(null)).toBe('NO READING')
    expect(moodFor(0)).toBe('CALM')
    expect(moodFor(39)).toBe('CALM')
    expect(moodFor(40)).toBe('SIMMERING')
    expect(moodFor(74)).toBe('SIMMERING')
    expect(moodFor(75)).toBe('BOILING')
    expect(moodFor(91)).toBe('BOILING')
    expect(moodFor(92)).toBe('BOILING OVER')
  })

  it('maps moods to bubble counts', () => {
    expect([moodFor(10), moodFor(50), moodFor(80), moodFor(99)].map(bubblesFor)).toEqual([1, 3, 5, 5])
    expect(bubblesFor('NO READING')).toBe(0)
  })
})

describe('bar', () => {
  it('draws the CLI segment', () => {
    expect(bar(62)).toBe('██████░░░░')
    expect(bar(0)).toBe('░░░░░░░░░░')
    expect(bar(100)).toBe('██████████')
    expect(bar(null)).toBeNull()
  })
})

describe('normalizePercent', () => {
  it('converts header fractions and leaves percentages alone', () => {
    expect(normalizePercent(0.62, 'sdk-event')).toBe(62)
    expect(normalizePercent(62, 'sdk-usage')).toBe(62)
    expect(normalizePercent(62, 'statusline')).toBe(62)
    expect(normalizePercent(140, 'statusline')).toBe(100)
  })
})

describe('toEpochMs', () => {
  it('handles unix seconds, ms and ISO strings', () => {
    expect(toEpochMs(1_760_000_000)).toBe(1_760_000_000_000)
    expect(toEpochMs(1_760_000_000_000)).toBe(1_760_000_000_000)
    expect(toEpochMs('2026-10-06T02:20:00.126223+00:00')).toBe(Date.parse('2026-10-06T02:20:00.126Z'))
    expect(toEpochMs(null)).toBeNull()
    expect(toEpochMs('nope')).toBeNull()
  })
})

describe('isFresh', () => {
  it('treats readings older than ten minutes as no reading', () => {
    const now = 1_000_000_000
    const r = { percent: 50, resetsAt: null, observedAt: now - STALE_AFTER_MS, source: 'statusline' as const }
    expect(isFresh(r, now)).toBe(true)
    expect(isFresh({ ...r, observedAt: now - STALE_AFTER_MS - 1 }, now)).toBe(false)
    expect(isFresh(null, now)).toBe(false)
  })
})
