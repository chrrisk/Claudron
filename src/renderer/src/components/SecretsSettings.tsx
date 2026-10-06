import { useEffect, useState } from 'react'
import type { SecretMeta } from '@shared/ssh'
import { useSettings } from '../store/settings'

export function SecretsSettings(): React.JSX.Element {
  const hosts = useSettings((s) => s.settings.sshHosts)
  const sudoSecret = useSettings((s) => s.settings.sudoSecret)
  const update = useSettings((s) => s.update)
  const [items, setItems] = useState<SecretMeta[]>([])
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [shown, setShown] = useState(false)
  const [scope, setScope] = useState('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.claudron.invoke('secrets:list').then(setItems)
  }, [])

  const scopeName = (s: string): string => (s === 'all' ? 'All hosts' : (hosts.find((h) => h.id === s)?.label ?? 'Removed host'))
  const names = [...new Set(items.map((i) => i.name))]
  const ready = name.trim() !== '' && value !== ''

  const save = async (): Promise<void> => {
    const res = await window.claudron.invoke('secrets:add', name.trim(), value, scope)
    if (res.ok) {
      setItems(res.secrets)
      setName('')
      setValue('')
      setShown(false)
      setError(null)
    } else setError(res.error)
  }

  return (
    <>
      <span className="pop-hint">
        Name them anything. Claude can use them on your SSH hosts but never sees the value. Stored encrypted on this computer.
      </span>
      {items.map((s) => (
        <div key={s.id} className="secret-row">
          <span className="mono">{s.name}</span>
          <span className="pop-hint">{scopeName(s.scope)}</span>
          <span className="mono" style={{ color: 'var(--muted)' }}>
            ••••••••
          </span>
          <button className="link-btn" onClick={() => void window.claudron.invoke('secrets:remove', s.id).then(setItems)}>
            Delete
          </button>
        </div>
      ))}
      <div className="secret-form">
        <input
          className="pop-input"
          autoComplete="off"
          spellCheck={false}
          placeholder="name, e.g. SUDO_PASS or GITHUB_TOKEN"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="pop-input"
          type={shown ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && ready) void save()
          }}
        />
        <label className="pop-check">
          <input type="checkbox" checked={shown} onChange={() => setShown((x) => !x)} />
          Show
        </label>
        <select className="pop-input" aria-label="Use on" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">Use on: all hosts</option>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              Use on: {h.label}
            </option>
          ))}
        </select>
        <button className="ssh-btn primary" disabled={!ready} onClick={() => void save()}>
          Save secret
        </button>
        {error && (
          <span className="pop-hint" style={{ color: 'var(--ssh-blood)' }}>
            {error}
          </span>
        )}
      </div>
      {names.length > 0 && (
        <label className="pop-field">
          <span className="pop-hint">Which one is your sudo password?</span>
          <select
            className="pop-input"
            aria-label="Sudo password secret"
            value={sudoSecret}
            onChange={(e) => update({ sudoSecret: e.target.value })}
          >
            <option value="">None</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  )
}
