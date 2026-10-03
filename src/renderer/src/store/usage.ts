import { create } from 'zustand'
import type { UsageSnapshot } from '@shared/usage'

export const useUsage = create<{ usage: UsageSnapshot }>(() => ({
  usage: { session: null, weekly: null, plansApply: null }
}))

export async function hydrateUsage(): Promise<void> {
  useUsage.setState({ usage: await window.wraith.invoke('usage:get') })
  window.wraith.on('usage:changed', (usage) => useUsage.setState({ usage }))
}
