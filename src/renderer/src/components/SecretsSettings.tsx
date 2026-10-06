import { useEffect, useState } from 'react'
import type { SecretMeta } from '@shared/ssh'
import { useSettings } from '../store/settings'

export function SecretsSettings(): React.JSX.Element {
  const hosts = useSettings((s) => s.settings.sshHosts)
  const [items, setItems] = useState<SecretMeta[]>([])
  const [value, setValue] = useState('')
  const [shown, setShown] = useState(false)
  const [scope, setScope] = useState('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.claudron.invoke('secrets:list').then(setItems)
  }, [])

  const scopeName = (s: string): string => (s === 'all' ? 'All hosts' : (hosts.find((h) => h.id === s)?.label ?? 'Removed host'))

  const save = async (): Promise<void> => {
    const res = await window.claudron.invoke('secrets:add', 'SUDO', value, scope)
    if (res.ok) {
      setItems(res.secrets)
      setValue('')
      setShown(false)
      setError(null)
    } else setError(res.error)
  }

  return (
    <>
      <span className="pop-hint">
        Sudo password Claude can use on your SSH hosts but never sees. Stored encrypted on this computer.
      </span>
      {items.map((s) => (
        <div key={s.id} className="secret-row">
          <span className="mono">sudo password</span>
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
          type={shown ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder="sudo password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value) void save()
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
        <button className="ssh-btn primary" disabled={!value} onClick={() => void save()}>
          Save password
        </button>
        {error && (
          <span className="pop-hint" style={{ color: 'var(--ssh-blood)' }}>
            {error}
          </span>
        )}
      </div>
    </>
  )
}
