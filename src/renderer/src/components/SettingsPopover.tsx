import { useEffect, useRef, useState } from 'react'
import type { HauntLevel, Settings, SpotifyPresence, UiFont, ClaudronPermissionMode } from '@shared/settings'
import { soundDefaults } from '@shared/sounds'
import { useSettings } from '../store/settings'
import { useSpotify } from '../store/spotify'
import { FONT_FAMILIES } from '../themes'
import { AgentNoteSettings } from './AgentNoteSettings'
import { RemoteSettings } from './RemoteSettings'
import { SecretsSettings } from './SecretsSettings'
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

const MODELS: [string, string][] = [
  ['', 'Default'],
  ['opus', 'Opus'],
  ['sonnet', 'Sonnet'],
  ['haiku', 'Haiku']
]

const PERMISSIONS: [ClaudronPermissionMode, string, string][] = [
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

function SpotifySettings(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const status = useSpotify((s) => s.state.status)
  return (
    <>
      <label className="pop-field">
        <span className="pop-hint">Client id (from developer.spotify.com, no secret needed)</span>
        <input
          className="pop-input"
          spellCheck={false}
          placeholder="paste client id"
          defaultValue={settings.spotifyClientId}
          onBlur={(e) => e.target.value.trim() !== settings.spotifyClientId && update({ spotifyClientId: e.target.value.trim() })}
        />
      </label>
      <label className="pop-field">
        <span className="pop-hint">Pinned spooky playlist (optional link)</span>
        <input
          className="pop-input"
          spellCheck={false}
          placeholder="open.spotify.com/playlist/..."
          defaultValue={settings.spookyPlaylist}
          onBlur={(e) => update({ spookyPlaylist: e.target.value.trim() })}
        />
      </label>
      {status === 'connected' && (
        <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => void window.claudron.invoke('spotify:disconnect')}>
          Disconnect Spotify
        </button>
      )}
    </>
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

  const pickPermission = (mode: ClaudronPermissionMode): void => {
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
            options={PERMISSIONS.map(([v, l]) => [v, l] as [ClaudronPermissionMode, string])}
            value={settings.permissionMode}
            onPick={pickPermission}
            cols={2}
          />
          <span className="pop-hint">{PERMISSIONS.find(([v]) => v === settings.permissionMode)?.[2]}</span>
        </div>

        <div className="pop-section">
          <span className="pop-heading">MODEL</span>
          <Segmented label="Default model" options={MODELS} value={settings.model} onPick={set('model')} />
          <span className="pop-hint">Used for new sessions. Reconnect or reopen a project to apply.</span>
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
          {settings.spotify !== 'off' && <SpotifySettings />}
          <label className="pop-check">
            <input type="checkbox" checked={settings.cliRail} onChange={() => update({ cliRail: !settings.cliRail })} />
            Show cauldron and Spotify beside the terminal (CLI mode)
          </label>
        </div>

        <div className="pop-section">
          <span className="pop-heading">FOR THE RECORD</span>
          <AgentNoteSettings />
        </div>

        <div className="pop-section">
          <span className="pop-heading">REMOTE</span>
          <RemoteSettings />
        </div>

        <div className="pop-section">
          <span className="pop-heading">SECRETS</span>
          <SecretsSettings />
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
