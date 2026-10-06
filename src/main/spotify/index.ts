import { app, BrowserWindow } from 'electron'
import { DUCK_VOLUME, type SpotifyCommand, type SpotifyHit, type SpotifyRepeat, type SpotifyState, type SpotifyTrack } from '@shared/spotify'
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
  // Player commands can answer 200 with plain text (or nothing); only GETs carry JSON we use.
  if (method !== 'GET') return null
  const text = await res.text()
  try {
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

interface SpotifyImage {
  url: string
  width?: number | null
}

interface PlaybackJson {
  is_playing: boolean
  progress_ms: number | null
  shuffle_state?: boolean
  repeat_state?: SpotifyRepeat
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
      shuffle: p?.shuffle_state ?? false,
      repeat: p?.repeat_state ?? 'off',
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
  emit({ status: 'connected', playing: false, track: null, progressMs: 0, at: Date.now(), volume: null, shuffle: false, repeat: 'off', ducked: false, premiumRequired: false, error: null })
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
    emit({ status: 'connected', playing: false, track: null, progressMs: 0, at: Date.now(), volume: null, shuffle: false, repeat: 'off', ducked: false, premiumRequired: false, error: null })
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
    case 'shuffle': {
      const on = !state.shuffle
      patchConnected({ shuffle: on })
      return control(() => api('PUT', `/me/player/shuffle?state=${on}`))
    }
    case 'repeat': {
      const next: SpotifyRepeat = state.repeat === 'off' ? 'context' : state.repeat === 'context' ? 'track' : 'off'
      patchConnected({ repeat: next })
      return control(() => api('PUT', `/me/player/repeat?state=${next}`))
    }
    case 'skeletons':
      return control(async () => {
        const hit = (await spotifySearch('spooky scary skeletons')).find((h) => h.kind === 'track')
        if (!hit) throw new Error('Could not find the skeletons')
        await playOnDevice(hit)
        await api('PUT', '/me/player/repeat?state=track')
        patchConnected({ repeat: 'track' })
      })
  }
}

interface SearchJson {
  tracks?: { items: ({ uri: string; name: string; artists?: { name: string }[]; album?: { uri?: string; images?: SpotifyImage[] } } | null)[] }
  playlists?: { items: ({ uri: string; name: string; owner?: { display_name?: string }; images?: SpotifyImage[] | null } | null)[] }
}

const smallArt = (images: SpotifyImage[] | null | undefined): string | null => {
  const list = images ?? []
  return [...list].sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find((i) => (i.width ?? 640) >= 40)?.url ?? list[0]?.url ?? null
}

export async function spotifySearch(query: string): Promise<SpotifyHit[]> {
  const q = query.trim()
  if (state.status !== 'connected' || !q) return []
  try {
    const res = await api<SearchJson>('GET', `/search?type=track,playlist&limit=10&q=${encodeURIComponent(q)}`)
    const tracks: SpotifyHit[] = (res?.tracks?.items ?? [])
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((t) => ({ uri: t.uri, kind: 'track', title: t.name, sub: t.artists?.map((a) => a.name).join(', ') ?? '', artUrl: smallArt(t.album?.images), context: t.album?.uri ?? null }))
    const lists: SpotifyHit[] = (res?.playlists?.items ?? [])
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((p) => ({ uri: p.uri, kind: 'playlist', title: p.name, sub: `playlist · ${p.owner?.display_name ?? 'spotify'}`, artUrl: smallArt(p.images), context: null }))
    return [...tracks, ...lists]
  } catch (err) {
    patchConnected({ error: (err as Error).message })
    return []
  }
}

/** Targets a device explicitly: a bare play can be accepted and still start nothing when none is active. */
async function playOnDevice(hit: SpotifyHit): Promise<void> {
  const devs = await api<{ devices: { id: string | null; is_active: boolean; is_restricted: boolean }[] }>('GET', '/me/player/devices')
  const list = (devs?.devices ?? []).filter((d) => d.id && !d.is_restricted)
  const dev = list.find((d) => d.is_active) ?? list[0]
  if (!dev) throw new HttpError(404, 'no device')
  const body =
    hit.kind === 'playlist' ? { context_uri: hit.uri } : hit.context ? { context_uri: hit.context, offset: { uri: hit.uri } } : { uris: [hit.uri] }
  await api('PUT', `/me/player/play?device_id=${encodeURIComponent(dev.id!)}`, body)
}

export async function spotifyPlay(hit: SpotifyHit): Promise<void> {
  if (state.status !== 'connected') return
  return control(() => playOnDevice(hit))
}

export async function spotifyVolume(percent: number): Promise<void> {
  if (state.status !== 'connected') return
  const v = Math.round(Math.min(100, Math.max(0, percent)))
  patchConnected({ volume: v })
  return control(() => api('PUT', `/me/player/volume?volume_percent=${v}`))
}

export async function spotifySeek(ms: number): Promise<void> {
  if (state.status !== 'connected') return
  const at = Math.max(0, Math.round(ms))
  patchConnected({ progressMs: at, at: Date.now() })
  return control(() => api('PUT', `/me/player/seek?position_ms=${at}`))
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
