import { homedir } from 'node:os'
import { app, BrowserWindow } from 'electron'
import { agent, listProjectSessions, loadHistory, openSession } from './agent'
import { findClaude } from './claude-path'
import { gitBranch, pickProject } from './projects'
import { killAllPtys, killPty, resizePty, spawnPty, writePty } from './pty'
import { loadShellEnv } from './shell-env'
import { getSettings, setSettings } from './settings-store'
import { handle, listen } from './ipc'
import { maybeSnapshot } from './snapshot'
import { applyWindowTheme, createMainWindow } from './window'

// Lets dev runs and screenshots use a throwaway profile.
if (process.env['WRAITH_USER_DATA']) app.setPath('userData', process.env['WRAITH_USER_DATA'])

let mainWindow: BrowserWindow | null = null

function registerIpc(): void {
  handle('app:info', () => ({ home: homedir(), version: app.getVersion() }))
  handle('settings:get', () => getSettings())
  handle('settings:set', (patch) => {
    const prev = getSettings()
    const next = setSettings(patch)
    if (mainWindow && prev.theme !== next.theme) applyWindowTheme(mainWindow, next.theme)
    if (prev.permissionMode !== next.permissionMode) void agent.setPermissionMode(next.permissionMode)
    return next
  })
  handle('projects:pick', () => pickProject())
  handle('projects:branch', (path) => gitBranch(path))
  listen('window:minimize', () => mainWindow?.minimize())

  handle('claude:locate', async () => {
    await loadShellEnv()
    return findClaude()
  })
  handle('pty:spawn', (opts) => spawnPty(opts))
  listen('pty:write', (id, data) => writePty(id, data))
  listen('pty:resize', (id, cols, rows) => resizePty(id, cols, rows))
  listen('pty:kill', (id) => killPty(id))

  handle('agent:open', (opts) => openSession(opts))
  handle('agent:send', (key, text) => agent.send(key, text))
  handle('agent:interrupt', (key) => agent.interrupt(key))
  handle('agent:respond', (key, requestId, decision) => agent.respond(key, requestId, decision))
  handle('agent:close', (key) => agent.close(key))
  handle('agent:sessions', (cwd) => listProjectSessions(cwd))
  handle('agent:history', (sessionId, cwd) => loadHistory(sessionId, cwd))
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
    void loadShellEnv()
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

  app.on('before-quit', () => {
    killAllPtys()
    agent.closeAll()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
