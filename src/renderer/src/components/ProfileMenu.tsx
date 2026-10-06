import { useEffect, useRef, useState } from 'react'
import type { Profile } from '@shared/settings'
import { useSettings } from '../store/settings'
import { ConfirmButton } from './ConfirmButton'

export function ProfileMenu({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return
      if ((e.target as HTMLElement).closest?.('[aria-label="Tab profiles"]')) return
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

  const { profiles, activeProfileId } = settings

  const switchTo = (p: Profile): void => {
    update({ activeProfileId: p.id, projects: p.projects, activeProjectId: p.activeProjectId ?? p.projects[0]?.id ?? null })
    onClose()
  }

  const create = (): void => {
    const n = name.trim()
    if (!n) return
    const p: Profile = {
      id: crypto.randomUUID(),
      name: n,
      projects: settings.projects,
      activeProjectId: settings.activeProjectId
    }
    update({ profiles: [...profiles, p], activeProfileId: p.id })
    setName('')
  }

  const remove = (p: Profile): void =>
    update({ profiles: profiles.filter((x) => x.id !== p.id), activeProfileId: activeProfileId === p.id ? null : activeProfileId })

  return (
    <div className="host-pop profile-pop" ref={ref} role="dialog" aria-label="Tab profiles">
      <span className="pop-heading">PROFILES</span>
      {profiles.map((p) => (
        <div key={p.id} className="profile-row">
          <button className="host-row" aria-pressed={p.id === activeProfileId} onClick={() => switchTo(p)}>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="host-name">
                {p.name}
                {p.id === activeProfileId ? ' · active' : ''}
              </span>
              <span className="host-sub mono">
                {p.projects.length} tab{p.projects.length === 1 ? '' : 's'}
              </span>
            </span>
          </button>
          <ConfirmButton label="Delete" onConfirm={() => remove(p)} />
        </div>
      ))}
      {profiles.length === 0 && <span className="pop-hint">Save your open tabs as a profile to switch back to them later.</span>}
      <span className="pop-heading" style={{ marginTop: 8 }}>
        SAVE OPEN TABS AS
      </span>
      <input
        className="pop-input"
        spellCheck={false}
        maxLength={40}
        placeholder="profile name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
      />
      <button className="ssh-btn primary" disabled={!name.trim()} onClick={create}>
        Save profile
      </button>
    </div>
  )
}
