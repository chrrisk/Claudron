import { useEffect, useRef, useState } from 'react'
import { useSettings } from './store/settings'
import { restartAllTerminals } from './lib/terminals'
import { FONT_FAMILIES } from './themes'
import { TitleBar } from './components/TitleBar'
import { CliView } from './components/CliView'
import { EmptyState } from './components/EmptyState'
import { UiView } from './components/UiView'
import { SettingsPopover } from './components/SettingsPopover'
import { SoundEffects } from './components/SoundEffects'

export function App(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  return (
    <div className="app">
      <TitleBar settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((o) => !o)} />
      <SoundEffects />
      {settingsOpen && <SettingsPopover onClose={() => setSettingsOpen(false)} />}
      <main className="app-body">
        {!project ? (
          <EmptyState />
        ) : settings.mode === 'cli' ? (
          <CliView key={project.id} project={project} />
        ) : (
          <UiView key={project.id} project={project} />
        )}
      </main>
    </div>
  )
}
