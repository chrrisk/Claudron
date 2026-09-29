import { useEffect, useState, useSyncExternalStore } from 'react'

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Re-renders every `ms` while `enabled`. Returns a monotonically increasing tick. */
export function useTicker(ms: number, enabled = true): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const iv = setInterval(() => setTick((t) => t + 1), ms)
    return () => clearInterval(iv)
  }, [ms, enabled])
  return tick
}
