import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/chakra-petch/400.css'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import './styles/base.css'
import './styles/titlebar.css'
import './styles/cli.css'
import './styles/ui.css'
import './styles/popover.css'
import './styles/haunt.css'
import { installThemeVars, MONO } from './themes'
import { hydrateSettings } from './store/settings'
import { loadAppInfo } from './lib/paths'
import { App } from './App'

installThemeVars()
document.documentElement.style.setProperty('--mono-font', MONO)
document.body.classList.add(`platform-${window.wraith.platform}`)

void Promise.all([hydrateSettings(), loadAppInfo()]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
