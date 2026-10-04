import { create } from 'zustand'
import type { SpotifyCommand, SpotifyState } from '@shared/spotify'

export const useSpotify = create<{ state: SpotifyState }>(() => ({ state: { status: 'disconnected' } }))

export async function hydrateSpotify(): Promise<void> {
  useSpotify.setState({ state: await window.wraith.invoke('spotify:get') })
  window.wraith.on('spotify:state', (state) => useSpotify.setState({ state }))
}

export function spotify(cmd: SpotifyCommand): void {
  void window.wraith.invoke('spotify:command', cmd)
}

/** Progress ticks locally between the 3s polls while playing. */
export function liveProgress(s: SpotifyState, now = Date.now()): number {
  if (s.status !== 'connected' || !s.track) return 0
  const p = s.playing ? s.progressMs + (now - s.at) : s.progressMs
  return Math.min(p, s.track.durationMs)
}
