import { useEffect, useState } from 'react'
import type { Project } from '@shared/settings'
import { useAgent } from '../store/agent'
import { useSettings } from '../store/settings'
import { shortModel, shortPath } from '../lib/paths'

const MODE_LABEL = { ask: null, acceptEdits: 'accept edits', plan: 'plan', unleashed: null } as const

export function ContextStrip({ project }: { project: Project }): React.JSX.Element {
  const conv = useAgent((s) => s.convs[project.id])
  const mode = useSettings((s) => s.settings.permissionMode)
  const [branch, setBranch] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const load = (): void => {
      void window.wraith.invoke('projects:branch', project.path).then((b) => live && setBranch(b))
    }
    load()
    const iv = setInterval(load, 15000)
    return () => {
      live = false
      clearInterval(iv)
    }
  }, [project.path, conv?.busy])

  const ctx = conv?.contextPct ?? null
  const modeLabel = MODE_LABEL[mode]

  return (
    <div className="context-strip">
      <span className="fg" title={project.path}>
        {shortPath(project.path)}
      </span>
      {branch && <span className="chip">{branch}</span>}
      <span className="chip">{shortModel(conv?.model)}</span>
      {modeLabel && <span className="chip violet">{modeLabel}</span>}
      {mode === 'unleashed' && <span className="unleashed-badge">UNLEASHED</span>}
      <div className="spacer" />
      <span>ctx</span>
      <div className="meter" aria-hidden="true">
        <div style={{ width: `${ctx ?? 0}%` }} />
      </div>
      <span className="fg">{ctx === null ? '--' : `${ctx}%`}</span>
    </div>
  )
}
