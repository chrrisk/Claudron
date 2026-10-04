import type { Project } from '@shared/settings'
import { MOON_FRAMES } from '@shared/copy'
import { bar, isFresh, moodFor } from '@shared/usage'
import { useUsage } from '../store/usage'
import { useCli } from '../store/cli'
import { shortModel } from '../lib/paths'
import { getTerminal } from '../lib/terminals'
import { useHaunt } from '../lib/haunt'
import { useSettings } from '../store/settings'
import { useTicker } from '../lib/hooks'
import { SpotifySegment } from './Spotify'

function stateLabel(
  status: string | undefined,
  { waiting, busy, spooky, verb }: { waiting: boolean; busy: boolean; spooky: boolean; verb: string }
): string {
  if (status === 'exited') return 'exited'
  if (status === 'error') return 'error'
  if (waiting) return spooky ? 'at the door' : 'needs you'
  if (busy) return spooky ? `${verb}…` : 'working'
  return spooky ? 'lurking' : 'ready'
}

export function StatusLine({ project }: { project: Project }): React.JSX.Element {
  const tick = useTicker(700)
  const { spooky, still, copy } = useHaunt()
  const entry = getTerminal(project.id)
  const unleashed = useSettings((s) => s.settings.permissionMode === 'unleashed')
  const spotifyOn = useSettings((s) => s.settings.spotify !== 'off')
  const usage = useUsage((s) => s.usage)
  const cli = useCli((s) => s.sessions[project.id])
  const session = isFresh(usage.session) ? Math.round(usage.session.percent) : null
  const weekly = isFresh(usage.weekly) ? Math.round(usage.weekly.percent) : null
  const mood = moodFor(session)
  const moodColor = mood === 'CALM' ? 'var(--calm)' : mood === 'BOILING OVER' ? 'var(--danger)' : 'var(--warn)'
  const busy = entry?.status === 'running' && !!cli?.busy
  const waiting = entry?.status === 'running' && !!cli?.waiting
  const verb = copy.working[Math.floor(tick / 6) % copy.working.length].toLowerCase()
  const label = stateLabel(entry?.status, { waiting, busy, spooky, verb })
  const spin = busy ? (spooky && !still ? MOON_FRAMES[tick % 4] : '•') : '·'

  return (
    <div className="statusline" role="status">
      <span className="seg brand">WRAITH</span>
      {unleashed && <span className="seg unleashed">UNLEASHED</span>}
      <span className="seg state">
        {spin} <span className="fg">{label}</span>
      </span>
      <span className="seg">{shortModel(cli?.model)}</span>
      <span className="seg">
        ctx <span className="violet">{cli?.contextPct == null ? '--' : `${cli.contextPct}%`}</span>
      </span>
      <span className="seg" title="5-hour session usage">
        {session === null ? (
          <>
            cauldron <span className="muted">--</span>
          </>
        ) : (
          <>
            cauldron <span style={{ color: moodColor }}>{bar(session)}</span> {session}%
          </>
        )}
      </span>
      <span className="seg" title="Weekly usage">
        wk <span className={weekly === null ? 'muted' : 'violet'}>{weekly === null ? '--' : `${weekly}%`}</span>
      </span>
      <span className="spacer" />
      {spotifyOn && <SpotifySegment />}
    </div>
  )
}
