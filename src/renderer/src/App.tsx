import { useEffect, useState } from 'react'
import { useSettings } from './store/settings'
import { FONT_FAMILIES } from './themes'
import { TitleBar } from './components/TitleBar'

export function App(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.style.setProperty('--ui-font', FONT_FAMILIES[settings.font])
  }, [settings.theme, settings.font])

  return (
    <div className="app">
      <TitleBar settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((o) => !o)} />
      <main className="app-body">
        <div style={{ margin: 'auto', color: 'var(--muted)' }}>
          {settings.mode === 'ui' ? 'UI mode' : 'CLI mode'}
        </div>
      </main>
    </div>
  )
}
