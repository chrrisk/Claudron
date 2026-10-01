import type { Settings } from './settings'

/**
 * Sound toggles follow the haunt level until the user flips one. Matches the
 * mockup: the door creaks only in full haunt, the bell rings unless subtle.
 */
export function soundDefaults(s: Pick<Settings, 'haunt' | 'doorSound' | 'bellSound'>): { door: boolean; bell: boolean } {
  return {
    door: s.doorSound ?? s.haunt === 'full',
    bell: s.bellSound ?? s.haunt !== 'subtle'
  }
}
