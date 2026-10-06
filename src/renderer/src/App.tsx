import { useEffect, useRef, useState } from 'react'
import { useSettings } from './store/settings'
import { restartAllTerminals } from './lib/terminals'
import { FONT_FAMILIES } from './themes'
import { TitleBar } from './components/TitleBar'
import { CliView } from './components/CliView'
import { EmptyState } from './components/EmptyState'
import { UiView } from './components/UiView'
import { SettingsPopover } from './components/SettingsPopover'
import { HostPicker } from './components/HostPicker'
import { SecretToast } from './components/SecretToast'
import { SoundEffects } from './components/SoundEffects'
import { SpotifyPill } from './components/Spotify'
import { SkeletonParty } from './components/SkeletonParty'

export function App(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hostsOpen, setHostsOpen] = useState(false)
  const project = settings.projects.find((p) => p.id === settings.activeProjectId) ?? null

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.haunt = settings.haunt
    root.style.setProperty('--ui-font', FONT_FAMILIES[settings.font])
  }, [settings.theme, settings.font, settings.haunt])

  // Permission mode is global: running CLI sessions restart with --continue to pick it up.
  const prevMode = useRef(settings.permissionMode)
  useEffect(() => {
    if (prevMode.current === settings.permissionMode) return
    prevMode.current = settings.permissionMode
    void restartAllTerminals(settings.permissionMode)
  }, [settings.permissionMode])

  // Older tabs have no session id yet: adopt the folder's latest conversation, others start fresh.
  const migrating = useRef(false)
  useEffect(() => {
    const need = settings.projects.filter((p) => !p.ssh && !p.sessionId)
    if (!need.length || migrating.current) return
    migrating.current = true
    void (async () => {
      const claimed = new Set<string>()
      const ids = new Map<string, string>()
      for (const p of need) {
        const list = await window.claudron.invoke('agent:sessions', p.path)
        const free = list.find((s) => !claimed.has(s.sessionId) && !settings.projects.some((x) => x.sessionId === s.sessionId))
        const id = free?.sessionId ?? crypto.randomUUID()
        claimed.add(id)
        ids.set(p.id, id)
      }
      const cur = useSettings.getState().settings.projects
      useSettings.getState().update({ projects: cur.map((p) => (ids.has(p.id) && !p.sessionId ? { ...p, sessionId: ids.get(p.id) } : p)) })
      migrating.current = false
    })()
  }, [settings.projects])

  const effectiveMode = project?.ssh ? 'cli' : settings.mode

  return (
    <div className="app">
      <TitleBar
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((o) => !o)}
        onOpenHosts={() => setHostsOpen((o) => !o)}
        rightSlot={settings.spotify === 'pill' ? <SpotifyPill /> : null}
      />
      <SoundEffects />
      <SecretToast />
      <SkeletonParty />
      {settingsOpen && <SettingsPopover onClose={() => setSettingsOpen(false)} />}
      {hostsOpen && <HostPicker onClose={() => setHostsOpen(false)} />}
      <main className="app-body">
        {!project ? (
          <EmptyState />
        ) : !project.ssh && !project.sessionId ? null : effectiveMode === 'cli' ? (
          <CliView key={project.id} project={project} />
        ) : (
          <UiView key={project.id} project={project} />
        )}
      </main>
    </div>
  )
}
