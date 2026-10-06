import { homedir } from 'node:os'
import { app, BrowserWindow } from 'electron'
import { agent, listProjectSessions, loadHistory, openSession, permissionEvents } from './agent'
import { findClaude } from './claude-path'
import { gitBranch, pickProject } from './projects'
import { killAllPtys, killPty, resizePty, spawnPty, writePty } from './pty'
import { loadShellEnv } from './shell-env'
import { getSettings, setSettings } from './settings-store'
import { handle, listen } from './ipc'
import { maybeSnapshot } from './snapshot'
import {
  connectSpotify,
  disconnectSpotify,
  getSpotifyState,
  initSpotify,
  restoreVolumeOnQuit,
  setPermissionWaiting,
  spotifyCommand
} from './spotify'
import { addSecret, listSecrets, removeSecret } from './secrets'
import { readConfigHosts } from './ssh'
import { getUsage, installCliTap, onCliEvent, refreshUsage, startUsagePolling, stopUsage } from './usage'
import { applyWindowTheme, createMainWindow } from './window'

// Lets dev runs and screenshots use a throwaway profile.
if (process.env['CLAUDRON_USER_DATA']) app.setPath('userData', process.env['CLAUDRON_USER_DATA'])

let mainWindow: BrowserWindow | null = null

function registerIpc(): void {
  handle('app:info', () => ({ home: homedir(), version: app.getVersion() }))
  handle('settings:get', () => getSettings())
  handle('settings:set', (patch) => {
    const prev = getSettings()
    const next = setSettings(patch)
    if (mainWindow && prev.theme !== next.theme) applyWindowTheme(mainWindow, next.theme)
    if (prev.permissionMode !== next.permissionMode) void agent.setPermissionMode(next.permissionMode)
    if (prev.spotifyClientId !== next.spotifyClientId) void initSpotify()
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

  handle('usage:get', () => getUsage())
  handle('usage:refresh', () => refreshUsage())

  handle('spotify:get', () => getSpotifyState())
  handle('spotify:connect', () => connectSpotify())
  handle('spotify:disconnect', () => disconnectSpotify())
  handle('spotify:command', (cmd) => spotifyCommand(cmd))

  handle('ssh:config-hosts', () => readConfigHosts())
  handle('secrets:list', () => listSecrets())
  handle('secrets:add', (name, value, scope) => addSecret(name, value, scope))
  handle('secrets:remove', (id) => removeSecret(id))
}

/** Duck the music while any permission prompt waits, UI or CLI. */
function wireDucking(): void {
  let uiWaiting = false
  const cliWaiting = new Set<string>()
  const update = (): void => setPermissionWaiting(uiWaiting || cliWaiting.size > 0)
  permissionEvents.on('waiting', (w) => {
    uiWaiting = w
    update()
  })
  onCliEvent((id, kind) => {
    if (kind === 'permission') cliWaiting.add(id)
    else cliWaiting.delete(id)
    update()
  })
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
    app.setAppUserModelId('dev.claudron.app')
    void loadShellEnv()
    registerIpc()
    installCliTap()
    startUsagePolling()
    wireDucking()
    void initSpotify()
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

  let restored = false
  app.on('before-quit', (e) => {
    // Never leave someone's music stuck at 30%.
    if (!restored) {
      e.preventDefault()
      restored = true
      void Promise.race([restoreVolumeOnQuit(), new Promise((r) => setTimeout(r, 1500))]).then(() => app.quit())
      return
    }
    killAllPtys()
    agent.closeAll()
    stopUsage()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
