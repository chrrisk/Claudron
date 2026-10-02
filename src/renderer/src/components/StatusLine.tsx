import type { Project } from '@shared/settings'
import { MOON_FRAMES } from '@shared/copy'
import { getTerminal } from '../lib/terminals'
import { useHaunt } from '../lib/haunt'
import { useSettings } from '../store/settings'
import { useTicker } from '../lib/hooks'

export function StatusLine({ project }: { project: Project }): React.JSX.Element {
  const tick = useTicker(700)
  const { spooky, still, copy } = useHaunt()
  const entry = getTerminal(project.id)
  const unleashed = useSettings((s) => s.settings.permissionMode === 'unleashed')
  const busy = entry?.status === 'running' && Date.now() - entry.lastOutputAt < 1200
  const verb = copy.working[Math.floor(tick / 6) % copy.working.length].toLowerCase()
  const label =
    entry?.status === 'exited'
      ? 'exited'
      : entry?.status === 'error'
        ? 'error'
        : busy
          ? spooky
            ? `${verb}…`
            : 'working'
          : spooky
            ? 'lurking'
            : 'ready'
  const spin = busy ? (spooky && !still ? MOON_FRAMES[tick % 4] : '•') : '·'

  return (
    <div className="statusline" role="status">
      <span className="seg brand">WRAITH</span>
      {unleashed && <span className="seg unleashed">UNLEASHED</span>}
      <span className="seg state">
        {spin} <span className="fg">{label}</span>
      </span>
      <span className="seg">claude</span>
      <span className="seg">
        ctx <span className="violet">--</span>
      </span>
      <span className="seg">
        cauldron <span className="muted">--</span>
      </span>
      <span className="seg">
        wk <span className="muted">--</span>
      </span>
      <span className="spacer" />
    </div>
  )
}
