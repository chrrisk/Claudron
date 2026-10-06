export interface SpotifyTrack {
  title: string
  artist: string
  album: string
  artUrl: string | null
  durationMs: number
}

export type SpotifyState =
  | { status: 'no-client-id' }
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | {
      status: 'connected'
      playing: boolean
      track: SpotifyTrack | null
      progressMs: number
      /** Epoch ms of the poll that produced progressMs, so the UI can tick between polls. */
      at: number
      volume: number | null
      /** Volume is lowered while a permission prompt waits. */
      ducked: boolean
      /** Set after a 403: play/pause/skip/volume need Premium. */
      premiumRequired: boolean
      error: string | null
    }

export interface SpotifyHit {
  uri: string
  kind: 'track' | 'playlist'
  title: string
  sub: string
  artUrl: string | null
}

export type SpotifyCommand = 'toggle' | 'next' | 'previous' | 'spooky'

export const SPOTIFY_SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing'

/** Must match the redirect URI registered on the Spotify app. */
export const SPOTIFY_REDIRECT_PORT = 43117
export const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_REDIRECT_PORT}/callback`

export const DUCK_VOLUME = 30

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
