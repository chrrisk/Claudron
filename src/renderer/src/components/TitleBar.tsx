import { useEffect, useRef, useState } from 'react'
import type { Project } from '@shared/settings'
import { useSettings } from '../store/settings'
import { CloseIcon, GearIcon, LogoMark, MoonIcon, PlusIcon, RemoteIcon, SunriseIcon } from './icons'
import { HostChip, SshDot } from './SshBadge'
import { ProfileMenu } from './ProfileMenu'

interface Props {
  settingsOpen: boolean
  onToggleSettings: () => void
  onOpenHosts: () => void
  rightSlot?: React.ReactNode
}

export function TitleBar({ settingsOpen, onToggleSettings, onOpenHosts, rightSlot }: Props): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const isDark = settings.theme === 'dark'
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [profilesOpen, setProfilesOpen] = useState(false)
  const [armed, setArmed] = useState<string | null>(null)
  const armTimer = useRef(0)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ id: string; after: boolean } | null>(null)
  useEffect(() => () => window.clearTimeout(armTimer.current), [])
  const startRename = (p: Project): void => {
    setDraft(p.name)
    setEditing(p.id)
  }
  const commitRename = (p: Project): void => {
    const name = draft.trim()
    setEditing(null)
    if (name && name !== p.name) update({ projects: settings.projects.map((x) => (x.id === p.id ? { ...x, name } : x)) })
  }
  const activeProject = settings.projects.find((p) => p.id === settings.activeProjectId)
  const sshActive = !!activeProject?.ssh
  const isUi = settings.mode === 'ui' && !sshActive

  const openProject = async (): Promise<void> => {
    const project = await window.claudron.invoke('projects:pick')
    if (!project) return
    const existing = settings.projects.find((p) => p.path === project.path)
    if (existing) {
      update({ activeProjectId: existing.id })
      return
    }
    const fresh = { ...project, sessionId: crypto.randomUUID() }
    update({ projects: [...settings.projects, fresh], activeProjectId: fresh.id })
  }

  const duplicate = (p: Project): void => {
    if (p.ssh) return
    const base = p.name.replace(/ \d+$/, '')
    const taken = new Set(settings.projects.map((x) => x.name))
    let n = 2
    while (taken.has(`${base} ${n}`)) n++
    const copy: Project = { id: crypto.randomUUID(), name: `${base} ${n}`, path: p.path, sessionId: crypto.randomUUID() }
    update({ projects: [...settings.projects, copy], activeProjectId: copy.id })
  }

  /** Closing a tab drops its terminal view, so the first click only arms it. */
  const requestClose = (p: Project): void => {
    window.clearTimeout(armTimer.current)
    if (armed === p.id) {
      setArmed(null)
      closeProject(p)
      return
    }
    setArmed(p.id)
    armTimer.current = window.setTimeout(() => setArmed(null), 3000)
  }

  const moveTab = (fromId: string, toId: string, after: boolean): void => {
    if (fromId === toId) return
    const from = settings.projects.find((x) => x.id === fromId)
    if (!from) return
    const rest = settings.projects.filter((x) => x.id !== fromId)
    const at = rest.findIndex((x) => x.id === toId)
    if (at < 0) return
    rest.splice(after ? at + 1 : at, 0, from)
    update({ projects: rest })
  }

  const closeProject = (p: Project): void => {
    const projects = settings.projects.filter((x) => x.id !== p.id)
    const activeProjectId =
      settings.activeProjectId === p.id ? (projects[projects.length - 1]?.id ?? null) : settings.activeProjectId
    update({ projects, activeProjectId })
  }

  return (
    <header className="titlebar">
      <div className="brand">
        <LogoMark />
        <span className="brand-name">CLAUDRON</span>
      </div>

      <div className="tabs" role="tablist" aria-label="Projects">
        {settings.projects.map((p) => {
          const active = p.id === settings.activeProjectId
          return (
            <div
              key={p.id}
              role="tab"
              tabIndex={0}
              aria-selected={active}
              title={`${p.path}
Double-click or F2 to rename${p.ssh ? '' : ', right-click for a new tab here'}`}
              className={`tab ${dragId === p.id ? 'dragging' : ''} ${dropAt?.id === p.id ? (dropAt.after ? 'drop-after' : 'drop-before') : ''}`}
              draggable={editing !== p.id}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', p.id)
                setDragId(p.id)
              }}
              onDragOver={(e) => {
                if (!dragId) return
                e.preventDefault()
                const r = e.currentTarget.getBoundingClientRect()
                setDropAt({ id: p.id, after: e.clientX > r.left + r.width / 2 })
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId && dropAt) moveTab(dragId, dropAt.id, dropAt.after)
                setDragId(null)
                setDropAt(null)
              }}
              onDragEnd={() => {
                setDragId(null)
                setDropAt(null)
              }}
              onClick={() => update({ activeProjectId: p.id })}
              onDoubleClick={() => startRename(p)}
              onContextMenu={(e) => {
                e.preventDefault()
                duplicate(p)
              }}
              onKeyDown={(e) => {
                if (editing === p.id) return
                if (e.key === 'F2') startRename(p)
                else if (e.key === 'Enter' || e.key === ' ') update({ activeProjectId: p.id })
              }}
              onAuxClick={(e) => e.button === 1 && requestClose(p)}
            >
              {p.ssh ? <SshDot id={p.id} /> : active && <span className="dot" />}
              {p.ssh && <HostChip />}
              {editing === p.id ? (
                <input
                  className="tab-rename"
                  autoFocus
                  aria-label="Tab name"
                  maxLength={40}
                  spellCheck={false}
                  value={draft}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => commitRename(p)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') commitRename(p)
                    else if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <span className="label">{p.name}</span>
              )}
              {editing !== p.id && (
                <span
                  className="close edit"
                  role="button"
                  aria-label={`Rename ${p.name}`}
                  title="Rename tab"
                  onClick={(e) => {
                    e.stopPropagation()
                    startRename(p)
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8.5 1.8l1.7 1.7L4 9.7 1.8 10.2l.5-2.2z" />
                  </svg>
                </span>
              )}
              <span
                className={`close ${armed === p.id ? 'armed' : ''}`}
                role="button"
                aria-label={armed === p.id ? `Confirm close ${p.name}` : `Close ${p.name}`}
                title={armed === p.id ? 'Click again to close this tab' : 'Close tab'}
                onClick={(e) => {
                  e.stopPropagation()
                  requestClose(p)
                }}
                onMouseLeave={() => armed === p.id && setArmed(null)}
              >
                {armed === p.id ? 'Close?' : <CloseIcon />}
              </span>
            </div>
          )
        })}
        {activeProject && !activeProject.ssh && (
          <button
            className="icon-btn"
            aria-label="New tab in this folder"
            title="New tab in this folder"
            onClick={() => duplicate(activeProject)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.5" />
              <path d="M9.5 2.5H3.5a1 1 0 0 0-1 1v6" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button className="icon-btn" aria-label="Open project" title="Open project folder" onClick={openProject}>
          <PlusIcon />
        </button>
        <button
          className="icon-btn"
          aria-label="Tab profiles"
          aria-expanded={profilesOpen}
          title={
            settings.profiles.find((x) => x.id === settings.activeProfileId)
              ? `Profile: ${settings.profiles.find((x) => x.id === settings.activeProfileId)?.name}`
              : 'Tab profiles'
          }
          onClick={() => setProfilesOpen((o) => !o)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 2 12.5 5 7 8 1.5 5z" />
            <path d="M1.5 8 7 11l5.5-3" strokeLinecap="round" />
          </svg>
        </button>
        <button className="icon-btn" aria-label="Open SSH session" title="Open over SSH" onClick={onOpenHosts}>
          <RemoteIcon />
        </button>
      </div>

      {profilesOpen && <ProfileMenu onClose={() => setProfilesOpen(false)} />}

      <div className="spacer" />

      {rightSlot}

      <div className="segmented" role="group" aria-label="Interface style">
        <button
          aria-pressed={isUi}
          disabled={sshActive}
          title={sshActive ? 'SSH sessions run in CLI mode' : undefined}
          onClick={() => update({ mode: 'ui' })}
        >
          UI
        </button>
        <button className="mono" aria-pressed={!isUi} onClick={() => update({ mode: 'cli' })}>
          &gt;_ CLI
        </button>
      </div>

      <button
        className="square-btn"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => update({ theme: isDark ? 'light' : 'dark' })}
      >
        {isDark ? <MoonIcon /> : <SunriseIcon />}
      </button>

      <button className="square-btn" aria-label="Settings" aria-expanded={settingsOpen} onClick={onToggleSettings}>
        <GearIcon />
      </button>
    </header>
  )
}
