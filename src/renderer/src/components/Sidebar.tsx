import { timeAgo, MOON_FRAMES, formatDuration } from '@shared/copy'
import type { Project } from '@shared/settings'
import { switchSession, useAgent } from '../store/agent'
import { useSettings } from '../store/settings'
import { useHaunt } from '../lib/haunt'
import { useTicker } from '../lib/hooks'
import { PlusIcon, TombstoneIcon } from './icons'

export function Sidebar({ project }: { project: Project }): React.JSX.Element {
  const conv = useAgent((s) => s.convs[project.id])
  const mode = useSettings((s) => s.settings.permissionMode)
  const { copy, spooky, still } = useHaunt()
  const tick = useTicker(700, !!conv?.busy && !still)

  const busy = conv?.busy ?? false
  const elapsed = conv?.turnStartedAt ? formatDuration(Date.now() - conv.turnStartedAt) : ''
  const verb = copy.working[Math.floor(tick / 6) % copy.working.length]
  const spin = spooky && !still ? MOON_FRAMES[tick % 4] : '•'
  const runLabel = busy ? `${spin} ${spooky ? `${verb}…` : 'running'} · ${elapsed}` : conv?.sessionId ? 'idle' : 'new'

  const old = (conv?.history ?? []).filter((h) => h.sessionId !== conv?.sessionId).slice(0, 8)

  return (
    <aside className="sidebar">
      <section>
        <div className="side-heading">SESSIONS</div>
        <div className="session current" aria-current="true">
          <span className="session-title">{conv?.title ?? (spooky ? 'A fresh haunting' : 'New session')}</span>
          <span className="session-run mono">{runLabel}</span>
        </div>
        {old.map((h) => (
          <button
            key={h.sessionId}
            className="session"
            title={h.title}
            onClick={() => void switchSession(project, mode, h)}
          >
            {spooky && <TombstoneIcon />}
            <span className="session-text">
              <span className="session-title">{copy.endedTitle(h.title)}</span>
              <span className="session-meta">{copy.endedMeta(timeAgo(h.lastModified))}</span>
            </span>
          </button>
        ))}
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
      <button className="summon-btn" onClick={() => void switchSession(project, mode)}>
        <PlusIcon />
        {copy.newSession}
      </button>
    </aside>
  )
}
