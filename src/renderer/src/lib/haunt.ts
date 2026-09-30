import { copyFor, type Copy } from '@shared/copy'
import type { HauntLevel } from '@shared/settings'
import { useSettings } from '../store/settings'
import { usePrefersReducedMotion } from './hooks'

export interface Haunt {
  level: HauntLevel
  spooky: boolean
  full: boolean
  copy: Copy
  /** True when the OS asks for reduced motion. Every animation checks this. */
  still: boolean
}

export function useHaunt(): Haunt {
  const level = useSettings((s) => s.settings.haunt)
  const still = usePrefersReducedMotion()
  return { level, spooky: level !== 'subtle', full: level === 'full', copy: copyFor(level), still }
}
