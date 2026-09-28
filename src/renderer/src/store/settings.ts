import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings } from '@shared/settings'

interface SettingsState {
  settings: Settings
  ready: boolean
  update: (patch: Partial<Settings>) => void
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  ready: false,
  update: (patch) => {
    // Optimistic: apply locally, then let main persist and echo back.
    set({ settings: { ...get().settings, ...patch } })
    void window.wraith.invoke('settings:set', patch)
  }
}))

export async function hydrateSettings(): Promise<void> {
  const settings = await window.wraith.invoke('settings:get')
  useSettings.setState({ settings, ready: true })
  window.wraith.on('settings:changed', (next) => useSettings.setState({ settings: next }))
}

/** Shorthand selector for a single setting. */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useSettings((s) => s.settings[key])
}
