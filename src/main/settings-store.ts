import Store from 'electron-store'
import { DEFAULT_SETTINGS, type Settings } from '@shared/settings'
import { broadcast } from './ipc'

// Created lazily so a userData override in index.ts applies before the file is opened.
let store: Store<Settings> | null = null
function getStore(): Store<Settings> {
  store ??= new Store<Settings>({ name: 'settings', defaults: DEFAULT_SETTINGS, clearInvalidConfig: true })
  return store
}

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...getStore().store }
}

export function setSettings(patch: Partial<Settings>): Settings {
  const s = getStore()
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue
    s.set(key as keyof Settings, value as never)
  }
  const next = getSettings()
  broadcast('settings:changed', next)
  return next
}
