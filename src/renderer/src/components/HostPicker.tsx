import { useEffect, useRef, useState } from 'react'
import type { Project } from '@shared/settings'
import { hostIdFor, hostLabel, isValidTarget, sshDisplay, type SshHost } from '@shared/ssh'
import { useSettings } from '../store/settings'
import { hostEgg } from '@shared/eggs'
import { useHaunt } from '../lib/haunt'
import { GhostIcon, HockeyMaskIcon, LogoMark } from './icons'

function HostIcon({ label }: { label: string }): React.JSX.Element {
  const { spooky } = useHaunt()
  const egg = spooky ? hostEgg(label) : null
  if (egg === 'mask') return <HockeyMaskIcon />
  if (egg === 'pumpkin') return <LogoMark size={16} />
  if (egg === 'balloon') {
    return <span aria-hidden="true" style={{ width: 11, height: 14, borderRadius: '50%', background: 'var(--ssh-blood)' }} />
  }
  return <GhostIcon />
}

export function HostPicker({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const [configHosts, setConfigHosts] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [folder, setFolder] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.claudron.invoke('ssh:config-hosts').then(setConfigHosts)
    const onDown = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return
      if ((e.target as HTMLElement).closest?.('[aria-label="Open SSH session"]')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const saved = settings.sshHosts
  const fromConfig: SshHost[] = configHosts
    .filter((h) => !saved.some((s) => s.target === h))
    .map((h) => ({ id: hostIdFor(h), target: h, label: h, folder: '' }))

  const open = (host: SshHost): void => {
    const hosts = saved.some((h) => h.id === host.id) ? saved : [...saved, host]
    const pid = `ssh-${host.id}`
    const known = settings.projects.some((p) => p.id === pid)
    const project: Project = { id: pid, name: host.label, path: sshDisplay(host), ssh: { hostId: host.id } }
    update({
      sshHosts: hosts,
      projects: known ? settings.projects : [...settings.projects, project],
      activeProjectId: pid
    })
    onClose()
  }

  const valid = isValidTarget(target.trim())
  const add = (): void => {
    if (!valid) return
    const t = target.trim()
    open({ id: hostIdFor(t), target: t, label: hostLabel(t), folder: folder.trim() })
  }

  const row = (h: SshHost): React.JSX.Element => (
    <button key={h.id} className="host-row" onClick={() => open(h)}>
      <HostIcon label={h.label} />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="host-name">{h.label}</span>
        <span className="host-sub mono">{sshDisplay(h)}</span>
      </span>
    </button>
  )

  return (
    <div className="host-pop" ref={ref} role="dialog" aria-label="SSH hosts">
      <span className="pop-heading">OVER THE WIRE</span>
      {saved.map(row)}
      {fromConfig.map(row)}
      {saved.length + fromConfig.length === 0 && <span className="pop-hint">No hosts yet. Haunt one below.</span>}
      <span className="pop-heading" style={{ marginTop: 8 }}>
        HAUNT A NEW HOST
      </span>
      <input
        className="pop-input"
        spellCheck={false}
        placeholder="user@host or ssh alias"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <input
        className="pop-input"
        spellCheck={false}
        placeholder="start folder (optional, e.g. ~/dev)"
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      {target && !valid && <span className="pop-hint">Letters, numbers, dots and dashes only. Add :port or user@ if needed.</span>}
      <button className="ssh-btn primary" disabled={!valid} onClick={add}>
        Connect
      </button>
    </div>
  )
}
