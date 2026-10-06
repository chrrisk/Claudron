import { useEffect, useRef, useState } from 'react'
import { SUDO_UNLUCKY } from '@shared/eggs'
import { useHaunt } from '../lib/haunt'

export function SecretToast(): React.JSX.Element | null {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>(0)
  const counts = useRef<Record<string, number>>({})
  const { spooky } = useHaunt()
  useEffect(
    () =>
      window.claudron.on('ssh:secret-used', ({ id, name }) => {
        const n = (counts.current[id] = (counts.current[id] ?? 0) + 1)
        setMsg(
          spooky && n === SUDO_UNLUCKY
            ? 'Unlucky for some.'
            : `Claude used your saved ${name === 'SUDO' ? 'sudo password' : name}${spooky ? ' (it never saw it)' : ''}`
        )
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setMsg(null), 2800)
      }),
    [spooky]
  )
  if (!msg) return null
  return (
    <div className="secret-toast" role="status">
      {msg}
    </div>
  )
}
