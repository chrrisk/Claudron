import { useEffect, useState } from 'react'

export const SKELETONS_EVENT = 'claudron:skeletons'
const PARTY_MS = 9000

/** Rainbow skeleton flossing over the app while Spooky Scary Skeletons plays. Click to send it away. */
export function SkeletonParty(): React.JSX.Element | null {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let t = 0
    const start = (): void => {
      setOn(true)
      window.clearTimeout(t)
      t = window.setTimeout(() => setOn(false), PARTY_MS)
    }
    window.addEventListener(SKELETONS_EVENT, start)
    return () => {
      window.removeEventListener(SKELETONS_EVENT, start)
      window.clearTimeout(t)
    }
  }, [])
  if (!on) return null
  return (
    <div className="skeleton-party" role="presentation" onClick={() => setOn(false)}>
      <svg className="sk-rainbow" viewBox="0 0 120 200" width="240" height="400" aria-hidden="true">
        <g className="sk-body" fill="none" stroke="#ff3b3b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="60" cy="28" r="18" fill="#ff3b3b" fillOpacity="0.15" />
          <path d="M52 24v4M68 24v4M54 38h12M57 38v5M63 38v5" strokeWidth="3.5" />
          <path d="M60 46v70" />
          <path d="M44 62h32M46 76h28M48 90h24" strokeWidth="4" />
          <path d="M42 118h36" strokeWidth="6" />
          <path className="sk-leg-l" d="M50 118l-8 36 4 30" />
          <path className="sk-leg-r" d="M70 118l8 36-4 30" />
          <g className="sk-arm sk-arm-l">
            <path d="M44 56l-18 22 26 22" />
          </g>
          <g className="sk-arm sk-arm-r">
            <path d="M76 56l18 22-26 22" />
          </g>
        </g>
      </svg>
      <span className="sk-caption">spooky scary skeletons</span>
    </div>
  )
}
