import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  EVENT_CHANNELS,
  INVOKE_CHANNELS,
  SEND_CHANNELS,
  type EventMap,
  type ClaudronBridge
} from '@shared/ipc'

function assertChannel(table: Record<string, true>, channel: string): void {
  if (!Object.hasOwn(table, channel)) throw new Error(`claudron: unknown ipc channel "${channel}"`)
}

const bridge: ClaudronBridge = {
  platform: process.platform as ClaudronBridge['platform'],

  invoke(channel, ...args) {
    assertChannel(INVOKE_CHANNELS, channel)
    return ipcRenderer.invoke(channel, ...args)
  },

  send(channel, ...args) {
    assertChannel(SEND_CHANNELS, channel)
    ipcRenderer.send(channel, ...args)
  },

  on(channel, listener) {
    assertChannel(EVENT_CHANNELS, channel)
    const wrapped = (_e: IpcRendererEvent, payload: EventMap[typeof channel]): void => listener(payload)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  }
}

contextBridge.exposeInMainWorld('claudron', bridge)
