import { app, BrowserWindow } from 'electron'
import { gitBranch, pickProject } from './projects'
import { getSettings, setSettings } from './settings-store'
import { handle, listen } from './ipc'
import { maybeSnapshot } from './snapshot'
import { applyWindowTheme, createMainWindow } from './window'

let mainWindow: BrowserWindow | null = null

function registerIpc(): void {
  handle('settings:get', () => getSettings())
  handle('settings:set', (patch) => {
    const prev = getSettings()
    const next = setSettings(patch)
    if (mainWindow && prev.theme !== next.theme) applyWindowTheme(mainWindow, next.theme)
    return next
  })
  handle('projects:pick', () => pickProject())
  handle('projects:branch', (path) => gitBranch(path))
  listen('window:minimize', () => mainWindow?.minimize())
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('dev.wraith.app')
    registerIpc()
    mainWindow = createMainWindow(getSettings().theme)
    mainWindow.on('closed', () => (mainWindow = null))
    maybeSnapshot(mainWindow)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow(getSettings().theme)
        mainWindow.on('closed', () => (mainWindow = null))
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
