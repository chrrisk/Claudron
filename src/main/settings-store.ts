import Store from 'electron-store'
import { DEFAULT_SETTINGS, type Settings } from '@shared/settings'
import { broadcast } from './ipc'

const store = new Store<Settings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS,
  clearInvalidConfig: true
})

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...store.store }
}

export function setSettings(patch: Partial<Settings>): Settings {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue
    store.set(key as keyof Settings, value as never)
  }
  const next = getSettings()
  broadcast('settings:changed', next)
  return next
}
