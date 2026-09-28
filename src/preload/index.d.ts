import type { WraithBridge } from '../shared/ipc'

declare global {
  interface Window {
    wraith: WraithBridge
  }
}

export {}
