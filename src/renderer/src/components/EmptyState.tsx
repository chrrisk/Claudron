import { useSettings } from '../store/settings'
import { LogoMark } from './icons'

export function EmptyState(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const spooky = settings.haunt !== 'subtle'

  const open = async (): Promise<void> => {
    const project = await window.wraith.invoke('projects:pick')
    if (!project) return
    update({ projects: [...settings.projects, project], activeProjectId: project.id })
  }

  return (
    <div className="empty-state">
      <LogoMark size={56} />
      <h1>{spooky ? 'Nothing haunts this window yet' : 'No project open'}</h1>
      <p>{spooky ? 'Pick a folder and Claude will move in.' : 'Open a project folder to start a Claude Code session.'}</p>
      <button className="primary-btn" onClick={open}>
        Open a folder
      </button>
    </div>
  )
}
