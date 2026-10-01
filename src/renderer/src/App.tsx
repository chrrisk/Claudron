import { useEffect, useState } from 'react'
import { useSettings } from './store/settings'
import { FONT_FAMILIES } from './themes'
import { TitleBar } from './components/TitleBar'
import { CliView } from './components/CliView'
import { EmptyState } from './components/EmptyState'
import { UiView } from './components/UiView'

export function App(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const project = settings.projects.find((p) => p.id === settings.activeProjectId) ?? null

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.style.setProperty('--ui-font', FONT_FAMILIES[settings.font])
  }, [settings.theme, settings.font])

  return (
    <div className="app">
      <TitleBar settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((o) => !o)} />
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
