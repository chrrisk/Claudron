import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
import { Fog, TerminalBats } from './Haunting'
import { PumpkinBanner } from './PumpkinBanner'
import { SshLost } from './SshLost'
import { Glow } from './Glow'
import { RightRail } from './RightRail'
import { HockeyMaskIcon } from './icons'
import { isFriday13 } from '@shared/eggs'
import { useHaunt } from '../lib/haunt'
import { shortPath } from '../lib/paths'

export function CliView({ project }: { project: Project }): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const theme = useSettings((s) => s.settings.theme)
  const permissionMode = useSettings((s) => s.settings.permissionMode)
  const cliRail = useSettings((s) => s.settings.cliRail)
  const [typed, setTyped] = useState(false)
  const [branch, setBranch] = useState<string | null>(null)

  const isSsh = !!project.ssh
  const { spooky } = useHaunt()
  const f13 = spooky && isFriday13(new Date())
  useEffect(() => {
    if (isSsh) return
    void window.claudron.invoke('projects:branch', project.path).then(setBranch)
  }, [project.path, isSsh])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const entry = ensureTerminal(project.id, project.path, theme, project.ssh?.hostId)
    void attachTerminal(entry, host, permissionMode)
    // onKey, not onData: xterm also emits onData for automatic replies to claude's terminal queries.
    const typed = entry.term.onKey(() => {
      setTyped(true)
      typed.dispose()
    })
    const ro = new ResizeObserver(() => safeFit(entry))
    ro.observe(host)
    return () => {
      ro.disconnect()
      typed.dispose()
      entry.element.remove()
    }
    // theme and permission mode are applied separately; re-attaching would respawn nothing but is wasteful
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.path])

  useEffect(() => applyTerminalTheme(theme), [theme])

  const status = useSyncExternalStore(subscribeTerminals, () => getTerminal(project.id)?.status ?? 'idle')

  return (
    <div className="cli-wrap">
    <div className={`cli ${isSsh ? 'ssh' : ''} ${f13 ? 'f13' : ''}`}>
      {f13 && isSsh && <HockeyMaskIcon className="f13-mask" aria-hidden />}
      <Fog />
      <TerminalBats />
      {spooky && <Glow />}
      <PumpkinBanner
        where={isSsh ? project.path : [shortPath(project.path), branch].filter(Boolean).join(' · ')}
        dismissed={typed}
      />
      <div className="cli-term" ref={hostRef} data-status={status} />
      <StatusLine project={project} />
      {isSsh && <SshLost project={project} />}
    </div>
    {cliRail && <RightRail />}
    </div>
  )
}
