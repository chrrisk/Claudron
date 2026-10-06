import { MOON_FRAMES, formatDuration } from '@shared/copy'
import type { Project } from '@shared/settings'
import { switchSession, useAgent } from '../store/agent'
import { useSettings } from '../store/settings'
import { useHaunt } from '../lib/haunt'
import { useTicker } from '../lib/hooks'
import { PlusIcon } from './icons'

export function Sidebar({ project }: { project: Project }): React.JSX.Element {
  const conv = useAgent((s) => s.convs[project.id])
  const mode = useSettings((s) => s.settings.permissionMode)
  const update = useSettings((s) => s.update)
  const projects = useSettings((s) => s.settings.projects)
  const { copy, spooky, still } = useHaunt()
  const tick = useTicker(700, !!conv?.busy && !still)

  const busy = conv?.busy ?? false
  const elapsed = conv?.turnStartedAt ? formatDuration(Date.now() - conv.turnStartedAt) : ''
  const verb = copy.working[Math.floor(tick / 6) % copy.working.length]
  const spin = spooky && !still ? MOON_FRAMES[tick % 4] : '•'
  const runLabel = busy ? `${spin} ${spooky ? `${verb}…` : 'running'} · ${elapsed}` : conv?.sessionId ? 'idle' : 'new'

  return (
    <aside className="sidebar">
      <section>
        <div className="side-heading">THIS TAB</div>
        <div className="session current" aria-current="true">
          <span className="session-title">{conv?.title ?? (spooky ? 'A fresh haunting' : 'New session')}</span>
          <span className="session-run mono">{runLabel}</span>
        </div>
      </section>

      <section>
        <div className="side-heading">RUNNER</div>
        <div className="runner mono">
          <span className="runner-dot on" />
          claude
        </div>
        <div className="runner mono muted">
          <span className="runner-dot" />
          any command
          <span className="soon">SOON</span>
        </div>
      </section>

      <div className="spacer" />
      <button className="summon-btn" onClick={() => {
          const next = { ...project, sessionId: crypto.randomUUID() }
          update({ projects: projects.map((p) => (p.id === project.id ? next : p)) })
          void switchSession(next, mode)
        }}>
        <PlusIcon />
        Start over
      </button>
    </aside>
  )
}
