import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '@shared/update'
import { broadcast } from './ipc'

let state: UpdateState = { kind: 'idle' }
let wired = false

function set(next: UpdateState): void {
  state = next
  broadcast('update:state', state)
}

function unsupported(): string | null {
  if (!app.isPackaged) return 'Updates only work in the installed app.'
  if (process.platform !== 'win32') return 'In-place updates are Windows only for now. Download the new build instead.'
  return null
}

function wire(): void {
  if (wired) return
  wired = true
  autoUpdater.autoDownload = true
  // Manual only: nothing installs until the user clicks Restart and update.
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('checking-for-update', () => set({ kind: 'checking' }))
  autoUpdater.on('update-not-available', () => set({ kind: 'none' }))
  autoUpdater.on('update-available', (i) => set({ kind: 'downloading', version: i.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => {
    if (state.kind === 'downloading') set({ ...state, percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (i) => set({ kind: 'ready', version: i.version }))
  autoUpdater.on('error', (e) => set({ kind: 'error', message: e.message.split('\n')[0].slice(0, 160) }))
}

export function getUpdateState(): UpdateState {
  return state
}

export async function checkForUpdates(): Promise<void> {
  const why = unsupported()
  if (why) return set({ kind: 'unsupported', reason: why })
  if (state.kind === 'checking' || state.kind === 'downloading' || state.kind === 'ready') return
  wire()
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    set({ kind: 'error', message: e instanceof Error ? e.message.split('\n')[0].slice(0, 160) : 'Update check failed.' })
  }
}

export function installUpdate(): void {
  if (state.kind === 'ready') autoUpdater.quitAndInstall(true, true)
}
