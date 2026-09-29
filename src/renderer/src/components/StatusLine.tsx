import type { Project } from '@shared/settings'
import { getTerminal } from '../lib/terminals'
import { useTicker } from '../lib/hooks'

export function StatusLine({ project }: { project: Project }): React.JSX.Element {
  useTicker(700)
  const entry = getTerminal(project.id)
  const busy = entry?.status === 'running' && Date.now() - entry.lastOutputAt < 1200
  const label =
    entry?.status === 'exited' ? 'exited' : entry?.status === 'error' ? 'error' : busy ? 'working' : 'ready'

  return (
    <div className="statusline" role="status">
      <span className="seg brand">WRAITH</span>
      <span className="seg state">
        {busy ? '•' : '·'} <span className="fg">{label}</span>
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
