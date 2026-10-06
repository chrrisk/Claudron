import { create } from 'zustand'
import type { SpotifyCommand, SpotifyHit, SpotifyState } from '@shared/spotify'

export const useSpotify = create<{ state: SpotifyState }>(() => ({ state: { status: 'disconnected' } }))

export async function hydrateSpotify(): Promise<void> {
  useSpotify.setState({ state: await window.claudron.invoke('spotify:get') })
  window.claudron.on('spotify:state', (state) => useSpotify.setState({ state }))
}

export function spotify(cmd: SpotifyCommand): void {
  void window.claudron.invoke('spotify:command', cmd)
}

export const spotifySearch = (q: string): Promise<SpotifyHit[]> => window.claudron.invoke('spotify:search', q)
export const spotifyPlay = (hit: SpotifyHit): Promise<void> => window.claudron.invoke('spotify:play', hit)
export const spotifyVolume = (pct: number): Promise<void> => window.claudron.invoke('spotify:volume', pct)
export const spotifySeek = (ms: number): Promise<void> => window.claudron.invoke('spotify:seek', ms)

/** Progress ticks locally between the 3s polls while playing. */
export function liveProgress(s: SpotifyState, now = Date.now()): number {
  if (s.status !== 'connected' || !s.track) return 0
  const p = s.playing ? s.progressMs + (now - s.at) : s.progressMs
  return Math.min(p, s.track.durationMs)
}
