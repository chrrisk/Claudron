import { useState } from 'react'
import type { Project } from '@shared/settings'
import { useSettings } from '../store/settings'
import { CloseIcon, GearIcon, LogoMark, MoonIcon, PlusIcon, RemoteIcon, SunriseIcon } from './icons'
import { HostChip, SshDot } from './SshBadge'

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
    update({ projects: [...settings.projects, project], activeProjectId: project.id })
  }

  const duplicate = (p: Project): void => {
    if (p.ssh) return
    const base = p.name.replace(/ \d+$/, '')
    const taken = new Set(settings.projects.map((x) => x.name))
    let n = 2
    while (taken.has(`${base} ${n}`)) n++
    const copy: Project = { id: crypto.randomUUID(), name: `${base} ${n}`, path: p.path }
    update({ projects: [...settings.projects, copy], activeProjectId: copy.id })
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
Double-click to rename${p.ssh ? '' : ', right-click for a new tab here'}`}
              className="tab"
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
              onAuxClick={(e) => e.button === 1 && closeProject(p)}
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
              <span
                className="close"
                role="button"
                aria-label={`Close ${p.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  closeProject(p)
                }}
              >
                <CloseIcon />
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
        <button className="icon-btn" aria-label="Open SSH session" title="Open over SSH" onClick={onOpenHosts}>
          <RemoteIcon />
        </button>
      </div>

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
