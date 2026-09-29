import { useEffect, useRef, useSyncExternalStore } from 'react'
import '@xterm/xterm/css/xterm.css'
import type { Project } from '@shared/settings'
import { useSettings } from '../store/settings'
import {
  applyTerminalTheme,
  attachTerminal,
  ensureTerminal,
  getTerminal,
  safeFit,
  subscribeTerminals
} from '../lib/terminals'
import { StatusLine } from './StatusLine'

export function CliView({ project }: { project: Project }): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const theme = useSettings((s) => s.settings.theme)
  const permissionMode = useSettings((s) => s.settings.permissionMode)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const entry = ensureTerminal(project.id, project.path, theme)
    void attachTerminal(entry, host, permissionMode)
    const ro = new ResizeObserver(() => safeFit(entry))
    ro.observe(host)
    return () => {
      ro.disconnect()
      entry.element.remove()
    }
    // theme and permission mode are applied separately; re-attaching would respawn nothing but is wasteful
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.path])

  useEffect(() => applyTerminalTheme(theme), [theme])

  const status = useSyncExternalStore(subscribeTerminals, () => getTerminal(project.id)?.status ?? 'idle')

  return (
    <div className="cli">
      <div className="cli-term" ref={hostRef} data-status={status} />
      <StatusLine project={project} />
    </div>
  )
}
