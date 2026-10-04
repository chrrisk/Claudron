import { app, BrowserWindow } from 'electron'
import { DUCK_VOLUME, type SpotifyCommand, type SpotifyState, type SpotifyTrack } from '@shared/spotify'
import { broadcast } from '../ipc'
import { getSettings } from '../settings-store'
import { clearTokens, loadTokens, login, refresh, type Tokens } from './auth'

const API = 'https://api.spotify.com/v1'
const FOCUSED_POLL_MS = 3000
const BLURRED_POLL_MS = 15000

let tokens: Tokens | null = null
let state: SpotifyState = { status: 'disconnected' }
let pollTimer: ReturnType<typeof setTimeout> | null = null
let duck: { restoreTo: number } | null = null
let wantDuck = false

function clientId(): string {
  return getSettings().spotifyClientId.trim() || (import.meta.env.MAIN_VITE_SPOTIFY_CLIENT_ID ?? '').trim()
}

function emit(next: SpotifyState): void {
  state = next
  broadcast('spotify:state', state)
}

function patchConnected(p: Partial<Extract<SpotifyState, { status: 'connected' }>>): void {
  if (state.status !== 'connected') return
  emit({ ...state, ...p })
}

export function getSpotifyState(): SpotifyState {
  return state
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string
  ) {
    super(`Spotify ${status} ${reason}`)
  }
}

async function accessToken(): Promise<string> {
  if (!tokens) throw new HttpError(401, 'not connected')
  if (Date.now() >= tokens.expiresAt) tokens = await refresh(clientId(), tokens.refreshToken)
  return tokens.accessToken
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (res.status === 204 || res.status === 202) return null
  if (!res.ok) {
    let reason = ''
    try {
      const j = (await res.json()) as { error?: { reason?: string; message?: string } }
      reason = j.error?.reason ?? j.error?.message ?? ''
    } catch {
      // empty body
    }
    throw new HttpError(res.status, reason)
  }
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}

interface SpotifyImage {
  url: string
  width?: number | null
}

interface PlaybackJson {
  is_playing: boolean
  progress_ms: number | null
  device?: { volume_percent: number | null; supports_volume?: boolean }
  item?: {
    name: string
    duration_ms: number
    artists?: { name: string }[]
    album?: { name: string; images?: SpotifyImage[] }
    show?: { name: string; images?: SpotifyImage[] }
    images?: SpotifyImage[]
  } | null
}

function toTrack(item: PlaybackJson['item']): SpotifyTrack | null {
  if (!item) return null
  const images = item.album?.images ?? item.images ?? item.show?.images ?? []
  // Smallest image that is still at least 64px wide.
  const art = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find((i) => (i.width ?? 640) >= 64)
  return {
    title: item.name,
    artist: item.artists?.map((a) => a.name).join(', ') ?? item.show?.name ?? '',
    album: item.album?.name ?? '',
    artUrl: art?.url ?? images[0]?.url ?? null,
    durationMs: item.duration_ms
  }
}

async function poll(): Promise<void> {
  if (!tokens) return
  try {
    const p = await api<PlaybackJson>('GET', '/me/player?additional_types=episode')
    const base = state.status === 'connected' ? state : null
    emit({
      status: 'connected',
      playing: p?.is_playing ?? false,
      track: toTrack(p?.item),
      progressMs: p?.progress_ms ?? 0,
      at: Date.now(),
      volume: p?.device?.volume_percent ?? null,
      ducked: duck !== null,
      premiumRequired: base?.premiumRequired ?? false,
      error: null
    })
    void applyDuck()
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      await disconnectSpotify()
      return
    }
    patchConnected({ error: (err as Error).message })
  }
}

function schedulePoll(): void {
  if (pollTimer) clearTimeout(pollTimer)
  if (!tokens) return
  const focused = BrowserWindow.getAllWindows().some((w) => w.isFocused())
  pollTimer = setTimeout(async () => {
    await poll()
    schedulePoll()
  }, focused ? FOCUSED_POLL_MS : BLURRED_POLL_MS)
}

export async function initSpotify(): Promise<void> {
  if (!clientId()) {
    emit({ status: 'no-client-id' })
    return
  }
  tokens = await loadTokens()
  if (!tokens) {
    emit({ status: 'disconnected' })
    return
  }
  emit({ status: 'connected', playing: false, track: null, progressMs: 0, at: Date.now(), volume: null, ducked: false, premiumRequired: false, error: null })
  await poll()
  schedulePoll()
  if (!focusHooked) {
    focusHooked = true
    app.on('browser-window-focus', () => {
      if (!tokens) return
      void poll()
      schedulePoll()
    })
  }
}
let focusHooked = false

export async function connectSpotify(): Promise<void> {
  const id = clientId()
  if (!id) {
    emit({ status: 'no-client-id' })
    return
  }
  emit({ status: 'connecting' })
  try {
    tokens = await login(id)
    emit({ status: 'connected', playing: false, track: null, progressMs: 0, at: Date.now(), volume: null, ducked: false, premiumRequired: false, error: null })
    await poll()
    schedulePoll()
  } catch {
    emit({ status: 'disconnected' })
  }
}

export async function disconnectSpotify(): Promise<void> {
  tokens = null
  duck = null
  if (pollTimer) clearTimeout(pollTimer)
  await clearTokens()
  emit(clientId() ? { status: 'disconnected' } : { status: 'no-client-id' })
}

/** Runs a playback command. A 403 means the account is not Premium. */
async function control(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
    setTimeout(() => void poll(), 350)
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      patchConnected({ premiumRequired: true, error: 'Playback controls need Spotify Premium' })
    } else if (err instanceof HttpError && err.status === 404) {
      patchConnected({ error: 'Open Spotify on one of your devices first' })
    } else {
      patchConnected({ error: (err as Error).message })
    }
  }
}

/** Accepts spotify:playlist:ID or an open.spotify.com/playlist/ID link. */
function playlistUri(input: string): string | null {
  const s = input.trim()
  if (/^spotify:playlist:[A-Za-z0-9]+$/.test(s)) return s
  const m = /open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([A-Za-z0-9]+)/.exec(s)
  return m ? `spotify:playlist:${m[1]}` : null
}

async function spookyPlaylist(): Promise<string | null> {
  const pinned = playlistUri(getSettings().spookyPlaylist)
  if (pinned) return pinned
  const res = await api<{ playlists: { items: ({ uri: string } | null)[] } }>(
    'GET',
    '/search?type=playlist&limit=20&q=halloween'
  )
  const items = (res?.playlists.items ?? []).filter((x): x is { uri: string } => !!x)
  return items.length ? items[Math.floor(Math.random() * items.length)].uri : null
}

export async function spotifyCommand(cmd: SpotifyCommand): Promise<void> {
  if (state.status !== 'connected') return
  const playing = state.playing
  switch (cmd) {
    case 'toggle':
      patchConnected({ playing: !playing })
      return control(() => api('PUT', playing ? '/me/player/pause' : '/me/player/play'))
    case 'next':
      return control(() => api('POST', '/me/player/next'))
    case 'previous':
      return control(() => api('POST', '/me/player/previous'))
    case 'spooky':
      return control(async () => {
        const uri = await spookyPlaylist()
        if (!uri) throw new Error('No spooky playlist found')
        await api('PUT', '/me/player/shuffle?state=true').catch(() => undefined)
        await api('PUT', '/me/player/play', { context_uri: uri })
      })
  }
}

// ---------------------------------------------------------------------------
// Ducking: music dips to 30% while Claude waits at the door, then comes back.

export function setPermissionWaiting(waiting: boolean): void {
  wantDuck = waiting
  void applyDuck()
}

async function applyDuck(): Promise<void> {
  if (state.status !== 'connected' || state.premiumRequired) return
  if (wantDuck && !duck && state.playing && state.volume !== null && state.volume > DUCK_VOLUME) {
    duck = { restoreTo: state.volume }
    patchConnected({ ducked: true })
    await api('PUT', `/me/player/volume?volume_percent=${DUCK_VOLUME}`).catch(() => undefined)
  } else if (!wantDuck && duck) {
    const to = duck.restoreTo
    duck = null
    patchConnected({ ducked: false })
    await api('PUT', `/me/player/volume?volume_percent=${to}`).catch(() => undefined)
  }
}

export async function restoreVolumeOnQuit(): Promise<void> {
  wantDuck = false
  await applyDuck()
}
