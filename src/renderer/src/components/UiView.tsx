import { useEffect } from 'react'
import type { Project } from '@shared/settings'
import { ensureSession } from '../store/agent'
import { useSettings } from '../store/settings'
import { Composer } from './Composer'
import { ContextStrip } from './ContextStrip'
import { MessageList } from './MessageList'
import { Sidebar } from './Sidebar'
import { Cobweb, Fog, TaskToast } from './Haunting'

export function UiView({ project, rail }: { project: Project; rail?: React.ReactNode }): React.JSX.Element {
  const mode = useSettings((s) => s.settings.permissionMode)

  useEffect(() => {
    void ensureSession(project, mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  return (
    <div className="ui-mode">
      <Sidebar project={project} />
      <section className="conversation" aria-label="Conversation">
        <Cobweb />
        <Fog />
        <ContextStrip project={project} />
        <MessageList project={project} />
        <TaskToast projectKey={project.id} />
        <Composer project={project} />
      </section>
      {rail}
    </div>
  )
}
