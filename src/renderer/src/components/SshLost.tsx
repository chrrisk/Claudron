import { useSyncExternalStore } from 'react'
import type { Project } from '@shared/settings'
import { isFriday13 } from '@shared/eggs'
import { useHaunt } from '../lib/haunt'
import { getTerminal, reconnectTerminal, subscribeTerminals } from '../lib/terminals'
import { useSettings } from '../store/settings'

export function SshLost({ project }: { project: Project }): React.JSX.Element | null {
  const status = useSyncExternalStore(subscribeTerminals, () => getTerminal(project.id)?.status ?? 'idle')
  const mode = useSettings((s) => s.settings.permissionMode)
  const code = getTerminal(project.id)?.exitCode
  const { spooky } = useHaunt()
  const f13 = spooky && isFriday13(new Date())
  if (status !== 'exited' && status !== 'error') return null
  const unreachable = code === 255
  return (
    <div className="ssh-lost" role="alertdialog" aria-label="Connection lost">
      <div className="ssh-lost-card">
        <h3>{f13 ? 'ki ki ki ma ma ma' : 'CONNECTION LOST'}</h3>
        <p>
          {unreachable
            ? 'ssh could not connect or the link dropped. Check the host, your network and your keys.'
            : `The session on ${project.name} ended${code === undefined ? '' : ` (code ${code})`}.`}
        </p>
        <div className="ssh-lost-actions">
          <button className="ssh-btn primary" onClick={() => void reconnectTerminal(project.id, mode)}>
            {f13 ? 'Run to the cabin' : 'Reconnect'}
          </button>
          <button
            className="ssh-btn"
            onClick={() => void reconnectTerminal(project.id, mode, true)}
            title="Skip --continue, start a new conversation"
          >
            Start fresh
          </button>
        </div>
      </div>
    </div>
  )
}
