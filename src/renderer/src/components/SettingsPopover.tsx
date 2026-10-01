import { useEffect, useRef, useState } from 'react'
import type { HauntLevel, Settings, SpotifyPresence, UiFont, WraithPermissionMode } from '@shared/settings'
import { soundDefaults } from '@shared/sounds'
import { useSettings } from '../store/settings'
import { FONT_FAMILIES } from '../themes'
import { UnleashedWarning } from './UnleashedWarning'

const HAUNT: [HauntLevel, string][] = [
  ['subtle', 'Subtle'],
  ['spooky', 'Spooky'],
  ['full', 'Full haunt']
]

const HAUNT_HINT: Record<HauntLevel, string> = {
  subtle: 'Plain wording, no fog or bats. Good for screen shares and March.',
  spooky: 'Fog, candle flicker, moon spinner, tombstones and spooky wording.',
  full: 'Everything: bats on finished tasks, glitchy errors and sound effects.'
}

const FONTS: [UiFont, string][] = [
  ['chakra', 'Chakra Petch'],
  ['excali', 'Excalifont']
]

const SPOTIFY: [SpotifyPresence, string][] = [
  ['off', 'Off'],
  ['pill', 'Pill'],
  ['card', 'Card']
]

const PERMISSIONS: [WraithPermissionMode, string, string][] = [
  ['ask', 'Ask', 'Claude asks before running commands or editing files.'],
  ['acceptEdits', 'Accept edits', 'File edits go through. Commands still ask.'],
  ['plan', 'Plan', 'Read only. Claude proposes a plan before touching anything.'],
  ['unleashed', 'Unleashed', 'No prompts at all. Claude runs anything it wants.']
]

function Segmented<T extends string>({
  label,
  options,
  value,
  onPick,
  tall,
  family,
  cols
}: {
  label: string
  options: [T, string][]
  value: T
  onPick: (v: T) => void
  tall?: boolean
  family?: (v: T) => string
  cols?: number
}): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={label}
      className={`pop-seg ${tall ? 'tall' : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          aria-pressed={value === v}
          onClick={() => onPick(v)}
          style={family ? { fontFamily: family(v) } : undefined}
          className={v === 'unleashed' ? 'danger' : undefined}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export function SettingsPopover({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const ref = useRef<HTMLDivElement>(null)
  const [warn, setWarn] = useState(false)
  const sounds = soundDefaults(settings)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (warn) return
      const t = e.target as Node
      if (ref.current?.contains(t)) return
      if ((t as HTMLElement).closest?.('[aria-label="Settings"]')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !warn) onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, warn])

  const pickPermission = (mode: WraithPermissionMode): void => {
    if (mode === 'unleashed' && !settings.unleashedWarned) {
      setWarn(true)
      return
    }
    update({ permissionMode: mode })
  }

  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => update({ [k]: v } as Partial<Settings>)

  return (
    <>
      <div className="popover" ref={ref} role="dialog" aria-label="Settings">
        <div className="pop-section">
          <span className="pop-heading">HAUNT LEVEL</span>
          <Segmented label="Haunt level" options={HAUNT} value={settings.haunt} onPick={set('haunt')} tall />
          <span className="pop-hint">{HAUNT_HINT[settings.haunt]}</span>
        </div>

        <div className="pop-section">
          <span className="pop-heading">PERMISSIONS</span>
          <Segmented
            label="Permission mode"
            options={PERMISSIONS.map(([v, l]) => [v, l] as [WraithPermissionMode, string])}
            value={settings.permissionMode}
            onPick={pickPermission}
            cols={2}
          />
          <span className="pop-hint">{PERMISSIONS.find(([v]) => v === settings.permissionMode)?.[2]}</span>
        </div>

        <div className="pop-section">
          <span className="pop-heading">SOUND EFFECTS</span>
          <label className="pop-check">
            <input type="checkbox" checked={sounds.door} onChange={() => update({ doorSound: !sounds.door })} />
            Creaky door on permission prompts
          </label>
          <label className="pop-check">
            <input type="checkbox" checked={sounds.bell} onChange={() => update({ bellSound: !sounds.bell })} />
            Bell when a task finishes
          </label>
        </div>

        <div className="pop-section">
          <span className="pop-heading">FONT</span>
          <Segmented
            label="Font"
            options={FONTS}
            value={settings.font}
            onPick={set('font')}
            family={(v) => FONT_FAMILIES[v]}
          />
          <span className="pop-hint">Code and the terminal stay monospace so columns line up.</span>
        </div>

        <div className="pop-section">
          <span className="pop-heading">SPOTIFY PRESENCE</span>
          <Segmented label="Spotify presence" options={SPOTIFY} value={settings.spotify} onPick={set('spotify')} />
        </div>
      </div>
      {warn && (
        <UnleashedWarning
          onCancel={() => setWarn(false)}
          onConfirm={() => {
            setWarn(false)
            update({ permissionMode: 'unleashed', unleashedWarned: true })
          }}
        />
      )}
    </>
  )
}
