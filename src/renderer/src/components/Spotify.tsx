import { formatClock } from '@shared/spotify'
import { liveProgress, spotify, useSpotify } from '../store/spotify'
import { useHaunt } from '../lib/haunt'
import { useTicker } from '../lib/hooks'
import { GhostIcon } from './icons'

/** Placeholder art from the mockup: moon over violet hills. */
function ArtPlaceholder({ size, round }: { size: number; round?: boolean }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ borderRadius: round ? '50%' : 6, flex: 'none' }}>
      <rect width="64" height="64" fill="var(--art)" />
      <circle cx="44" cy="20" r="10" fill="var(--accent)" />
      {!round && <circle cx="48" cy="17" r="9" fill="var(--art)" />}
      <path d="M0 64V46l8-6 6 8 8-14 8 10 8-6 8 8 8-12 10 14v16z" fill="var(--violet)" opacity={round ? 1 : 0.8} />
    </svg>
  )
}

function Art({ url, size, round }: { url: string | null | undefined; size: number; round?: boolean }): React.JSX.Element {
  if (!url) return <ArtPlaceholder size={size} round={round} />
  return <img src={url} width={size} height={size} alt="" className="art" style={{ borderRadius: round ? '50%' : 6 }} />
}

const PrevIcon = (): React.JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 5h2v14H6zM20 5v14L9 12z" />
  </svg>
)
const NextIcon = (): React.JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
  </svg>
)
const PauseIcon = (): React.JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
)
const PlayIcon = (): React.JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4l13 8-13 8z" />
  </svg>
)

function NotConnected(): React.JSX.Element {
  const s = useSpotify((x) => x.state)
  const noId = s.status === 'no-client-id'
  return (
    <div className="rail-card spotify-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <span className="spotify-empty-title">Code with a soundtrack</span>
      <span className="spotify-empty-body">
        {noId
          ? 'Add a Spotify client id in settings to connect. The README has a two minute guide.'
          : 'Shows what is playing on any of your devices. Play and skip need Spotify Premium.'}
      </span>
      {!noId && (
        <button
          className="primary-btn"
          disabled={s.status === 'connecting'}
          onClick={() => void window.wraith.invoke('spotify:connect')}
        >
          {s.status === 'connecting' ? 'Waiting for the browser…' : 'Connect Spotify'}
        </button>
      )}
    </div>
  )
}

export function SpotifyCard(): React.JSX.Element {
  const s = useSpotify((x) => x.state)
  const { spooky } = useHaunt()
  useTicker(1000, s.status === 'connected' && s.playing)

  if (s.status !== 'connected') return <NotConnected />
  const progress = liveProgress(s)
  const dur = s.track?.durationMs ?? 0

  return (
    <div className={`rail-card spotify ${s.ducked ? 'ducked' : ''}`}>
      <div className="rail-heading">
        <span>{s.ducked ? 'CLAUDE NEEDS YOU' : 'NOW PLAYING'}</span>
        <span style={{ color: 'var(--ok)', letterSpacing: '0.08em' }}>Spotify</span>
      </div>
      <div className="track">
        <Art url={s.track?.artUrl} size={64} />
        <div className="track-text">
          <span className="track-title" title={s.track?.title}>
            {s.track?.title ?? 'Nothing playing'}
          </span>
          <span className="track-artist">{s.ducked ? 'volume lowered' : (s.track?.artist ?? 'Start something on any device')}</span>
        </div>
      </div>
      <div className="progress">
        <div className="progress-bar">
          <div style={{ width: dur ? `${(progress / dur) * 100}%` : 0 }} />
        </div>
        <div className="progress-times mono">
          <span>{formatClock(progress)}</span>
          <span>{formatClock(dur)}</span>
        </div>
      </div>
      <div className="transport">
        <button className="round-btn" aria-label="Previous track" onClick={() => spotify('previous')}>
          <PrevIcon />
        </button>
        <button className="round-btn play" aria-label={s.playing ? 'Pause' : 'Play'} onClick={() => spotify('toggle')}>
          <span className="play-glow" data-anim="flicker" aria-hidden="true" />
          {s.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="round-btn" aria-label="Next track" onClick={() => spotify('next')}>
          <NextIcon />
        </button>
      </div>
      {s.error && <div className="spotify-error">{s.error}</div>}
      {spooky && (
        <button className="spooky-btn" onClick={() => spotify('spooky')}>
          <GhostIcon />
          Summon a spooky playlist
        </button>
      )}
    </div>
  )
}

export function SpotifyPill(): React.JSX.Element | null {
  const s = useSpotify((x) => x.state)
  if (s.status !== 'connected' || !s.track) return null
  return (
    <button className="spotify-pill" aria-label={s.playing ? 'Pause' : 'Play'} onClick={() => spotify('toggle')} title={`${s.track.title} · ${s.track.artist}`}>
      <Art url={s.track.artUrl} size={28} round />
      <span className="pill-title">{s.track.title}</span>
      <span className="mono" style={{ color: 'var(--ok)' }}>
        {s.playing ? '▶' : '❚❚'}
      </span>
    </button>
  )
}

/** Status line segment for CLI mode. ctrl+space toggles too. */
export function SpotifySegment(): React.JSX.Element | null {
  const s = useSpotify((x) => x.state)
  useTicker(1000, s.status === 'connected' && s.playing)
  if (s.status !== 'connected' || !s.track) return null
  return (
    <button className="seg" aria-label={s.playing ? 'Pause' : 'Play'} title="ctrl+space" onClick={() => spotify('toggle')}>
      <span className="ok">{s.playing ? '▶' : '❚❚'}</span>
      <span className="seg-track">
        {s.track.title} · {s.track.artist}
      </span>
      <span className="muted">
        {formatClock(liveProgress(s))}/{formatClock(s.track.durationMs)}
      </span>
    </button>
  )
}
