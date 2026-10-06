import type { ClaudronBridge } from '../shared/ipc'

declare global {
  interface Window {
    claudron: ClaudronBridge
  }
}

export {}
