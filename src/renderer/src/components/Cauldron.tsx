import { bubblesFor, formatAge, formatReset, isFresh, moodFor, type Mood } from '@shared/usage'
import { useUsage } from '../store/usage'
import { useTicker } from '../lib/hooks'

const MOOD_COLOR: Record<Mood, string> = {
  CALM: 'var(--calm)',
  SIMMERING: 'var(--warn)',
  BOILING: 'var(--warn)',
  'BOILING OVER': 'var(--danger)',
  'NO READING': 'var(--muted)'
}

// Bubble spots from docs/mockups/Usage.dc.html: [x, rise above surface, radius]
const SPOTS: [number, number, number][] = [
  [78, 9, 4],
  [112, 20, 6],
  [128, 30, 3],
  [92, 26, 5],
  [140, 14, 4]
]

const POT = 'M28 36Q24 118 100 124Q176 118 172 36z'

export function CauldronPot({ percent, label }: { percent: number | null; label: string }): React.JSX.Element {
  const mood = moodFor(percent)
  const color = MOOD_COLOR[mood]
  const empty = percent === null
  const liqY = empty ? 124 : Math.max(30, 122 - 86 * (percent / 100))
  const bubbles = SPOTS.slice(0, bubblesFor(mood))
  const over = mood === 'BOILING OVER'

  return (
    <svg width="236" height="158" viewBox="0 0 200 134" role="img" aria-label={label} className="cauldron-svg">
      <defs>
        <clipPath id="claudron-pot">
          <path d={POT} />
        </clipPath>
      </defs>
      <path d={POT} fill="var(--pot)" />
      {!empty && (
        <g clipPath="url(#claudron-pot)">
          <rect x="0" y={liqY} width="200" height="140" fill={color} opacity="0.9" className="liquid" />
          <ellipse cx="100" cy={liqY} rx="80" ry="5" fill="var(--liquid-top)" opacity="0.5" />
        </g>
      )}
      {bubbles.map(([x, dy, r], i) => (
        <circle
          key={i}
          cx={x}
          cy={Math.max(4, liqY - dy)}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          className="bubble"
          data-anim="bubble"
          style={{ animationDelay: `${i * 0.45}s` }}
        />
      ))}
      <path
        d="M28 36Q24 118 100 124Q176 118 172 36"
        fill="none"
        stroke={empty ? 'var(--muted)' : 'var(--pot-edge)'}
        strokeWidth="2"
        strokeDasharray={empty ? '5 4' : undefined}
      />
      <rect
        x="18"
        y="30"
        width="164"
        height="10"
        rx="5"
        fill={empty ? 'none' : 'var(--pot-edge)'}
        stroke={empty ? 'var(--muted)' : 'none'}
        strokeDasharray={empty ? '5 4' : undefined}
      />
      {over && (
        <>
          <path d="M40 30Q60 22 100 24Q140 22 160 30L160 34Q140 28 100 30Q60 28 40 34z" fill={color} />
          <path d="M22 34q-4 10 0 22q4-6 0-22zM176 34q-4 16 0 30q4-10 0-30zM60 36q-3 8 0 14q3-5 0-14z" fill={color} className="drip" data-anim="drip" />
        </>
      )}
      <path d="M70 124l-6 9M130 124l6 9" stroke={empty ? 'var(--muted)' : 'var(--pot-edge)'} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Cauldron(): React.JSX.Element {
  useTicker(30_000) // keeps "as of" and reset countdowns honest
  const { session, weekly, plansApply } = useUsage((s) => s.usage)
  const s = isFresh(session) ? session : null
  const w = isFresh(weekly) ? weekly : null
  const pct = s ? Math.round(s.percent) : null
  const mood = moodFor(pct)
  const label = pct === null ? 'Cauldron empty, no usage reading' : `Cauldron ${pct} percent full, ${mood.toLowerCase()}`

  return (
    <div className={`rail-card cauldron ${mood === 'BOILING OVER' ? 'over' : ''}`}>
      <div className="rail-heading">
        <span>USAGE CAULDRON</span>
        <span style={{ color: MOOD_COLOR[mood], letterSpacing: '0.12em' }}>{mood}</span>
      </div>
      <CauldronPot percent={pct} label={label} />
      <div className="usage-rows">
        <div className="usage-row">
          <div className="usage-line">
            <span>5-hour session</span>
            <span className="mono">{pct === null ? '--%' : `${pct}%`}</span>
          </div>
          <div className="usage-bar">
            <div style={{ width: `${pct ?? 0}%`, background: MOOD_COLOR[mood] }} />
          </div>
          <div className="usage-sub">{s ? formatReset(s.resetsAt) : ' '}</div>
        </div>
        <div className="usage-row">
          <div className="usage-line">
            <span>Weekly</span>
            <span className="mono">{w ? `${Math.round(w.percent)}%` : '--%'}</span>
          </div>
          <div className="usage-bar">
            <div style={{ width: `${w ? w.percent : 0}%`, background: 'var(--violet)' }} />
          </div>
          <div className="usage-sub">{w ? formatReset(w.resetsAt) : ' '}</div>
        </div>
      </div>
      <div className="usage-foot">
        {s
          ? `as of ${formatAge(s.observedAt)}`
          : plansApply === false
            ? 'Plan limits only apply to claude.ai subscriptions.'
            : 'No reading from Claude Code yet.'}
        <button className="link-btn" onClick={() => void window.claudron.invoke('usage:refresh')}>
          refresh
        </button>
      </div>
    </div>
  )
}
