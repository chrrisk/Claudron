import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '@shared/copy'
import { useAgent } from '../store/agent'
import { useHaunt } from '../lib/haunt'
import { Bat, BellIcon } from './icons'

export function Fog(): React.JSX.Element | null {
  const { spooky } = useHaunt()
  return spooky ? <div className="fog" data-anim="fog" aria-hidden="true" /> : null
}

/**
 * Grows while you are away (up to 30 minutes), snaps back when you type.
 * Static at a fixed size in subtle mode.
 */
export function Cobweb(): React.JSX.Element {
  const { spooky } = useHaunt()
  const [idleMin, setIdleMin] = useState(0)
  const last = useRef(Date.now())

  useEffect(() => {
    if (!spooky) return
    const reset = (): void => {
      last.current = Date.now()
      setIdleMin(0)
    }
    window.addEventListener('keydown', reset)
    const iv = setInterval(() => setIdleMin((Date.now() - last.current) / 60000), 20000)
    return () => {
      window.removeEventListener('keydown', reset)
      clearInterval(iv)
    }
  }, [spooky])

  const scale = spooky ? 0.5 + Math.min(idleMin, 30) / 30 : 0.8
  return (
    <svg
      className="cobweb"
      width="150"
      height="150"
      viewBox="0 0 150 150"
      fill="none"
      aria-hidden="true"
      style={{ transform: `scale(${scale})` }}
    >
      <g stroke="var(--web)" strokeWidth="1">
        <path d="M150 0L20 0M150 0L40 70M150 0L90 120M150 0L150 140" />
        <path d="M120 0Q118 18 136 22Q146 24 150 28" />
        <path d="M88 0Q86 32 112 42Q136 50 150 58" />
        <path d="M56 0Q56 48 90 64Q122 80 150 90" />
        <path d="M28 0Q30 62 70 90Q108 112 150 120" />
      </g>
      <path d="M101 42v24" stroke="var(--web)" />
      <circle cx="101" cy="70" r="4" fill="var(--web)" />
    </svg>
  )
}

/** "Fix flaky CI test finished in 4m 12s", with bats in full haunt. */
export function TaskToast({ projectKey }: { projectKey: string }): React.JSX.Element | null {
  const finished = useAgent((s) => s.lastFinished)
  const { full, still, copy } = useHaunt()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!finished || finished.key !== projectKey || Date.now() - finished.at > 2000) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 6000)
    return () => clearTimeout(t)
  }, [finished, projectKey])

  if (!visible || !finished) return null
  return (
    <>
      <div className="task-toast" role="status">
        <BellIcon stroke="var(--accent)" />
        <span>
          <b>{finished.title}</b>{' '}
          {finished.ok ? `finished in ${formatDuration(finished.durationMs)}` : `stopped. ${copy.errorPrefix} see above`}
        </span>
      </div>
      {full && !still && (
        <>
          <Bat width={34} className="toast-bat" data-anim="bat" style={{ left: 330, bottom: 196, animation: 'claudronBat 2.8s ease-in-out infinite' }} />
          <Bat width={24} className="toast-bat" data-anim="bat" style={{ left: 380, bottom: 222, animation: 'claudronBat 2.2s ease-in-out infinite 0.4s' }} />
          <Bat width={18} className="toast-bat" data-anim="bat" style={{ left: 300, bottom: 236, opacity: 0.7, animation: 'claudronBat 2.5s ease-in-out infinite 0.9s' }} />
        </>
      )}
    </>
  )
}

/** A small flock crosses the top of the terminal every 15 to 40 seconds. Full haunt only. */
export function TerminalBats(): React.JSX.Element | null {
  const { full, still } = useHaunt()
  const [flight, setFlight] = useState(0)

  useEffect(() => {
    if (!full || still) return
    let t: ReturnType<typeof setTimeout>
    const schedule = (): void => {
      t = setTimeout(() => {
        setFlight((f) => f + 1)
        schedule()
      }, 15000 + Math.random() * 25000)
    }
    schedule()
    return () => clearTimeout(t)
  }, [full, still])

  if (!full || still || flight === 0) return null
  const flock: [number, number, number, number][] = [
    // [top, width, delay s, flap s]
    [10, 30, 0, 0.2],
    [24, 22, 0.35, 0.17],
    [4, 16, 0.8, 0.22]
  ]
  return (
    <div className="bat-lane" aria-hidden="true" key={flight}>
      {flock.map(([top, w, delay, flap], i) => (
        <span
          key={i}
          className="flyer"
          data-anim="flyby"
          style={{ top, animationDelay: `${delay}s`, opacity: i === 2 ? 0.7 : 1, transform: 'translate(-80px,0)' }}
        >
          <span className="flap" data-anim="flap" style={{ animationDuration: `${flap}s` }}>
            <Bat width={w} />
          </span>
        </span>
      ))}
    </div>
  )
}
