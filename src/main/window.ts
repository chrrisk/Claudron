import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import type { Theme } from '@shared/settings'

// Mirrors chrome / muted from the theme tokens so the native Windows caption buttons blend in.
const CHROME: Record<Theme, { color: string; symbolColor: string }> = {
  dark: { color: '#100d16', symbolColor: '#9c91b0' },
  light: { color: '#e7dfd0', symbolColor: '#5f5468' }
}
const BG: Record<Theme, string> = { dark: '#0c0a11', light: '#efe8dc' }

export const TITLE_BAR_HEIGHT = 48

export function createMainWindow(theme: Theme): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Wraith',
    backgroundColor: BG[theme],
    titleBarStyle: 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 16, y: 17 } }
      : { titleBarOverlay: { ...CHROME[theme], height: TITLE_BAR_HEIGHT - 1 } }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Links open in the real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

export function applyWindowTheme(win: BrowserWindow, theme: Theme): void {
  win.setBackgroundColor(BG[theme])
  if (process.platform !== 'darwin') {
    win.setTitleBarOverlay({ ...CHROME[theme], height: TITLE_BAR_HEIGHT - 1 })
  }
}
