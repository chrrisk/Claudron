import { BrowserWindow, ipcMain } from 'electron'
import type { EventMap, InvokeMap, SendMap } from '@shared/ipc'

export function handle<K extends keyof InvokeMap>(
  channel: K,
  fn: (...args: InvokeMap[K]['args']) => InvokeMap[K]['result'] | Promise<InvokeMap[K]['result']>
): void {
  ipcMain.handle(channel, (_e, ...args) => fn(...(args as InvokeMap[K]['args'])))
}

export function listen<K extends keyof SendMap>(channel: K, fn: (...args: SendMap[K]) => void): void {
  ipcMain.on(channel, (_e, ...args) => fn(...(args as SendMap[K])))
}

export function broadcast<K extends keyof EventMap>(channel: K, payload: EventMap[K]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}
