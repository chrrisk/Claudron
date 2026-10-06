import { sshDisplay, type SshHost } from '@shared/ssh'
import { useSettings } from '../store/settings'
import { disposeTerminal } from '../lib/terminals'
import { ConfirmButton } from './ConfirmButton'

export function RemoteSettings(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const { sshHosts: hosts, sshKeepalive, sshKeepaliveInterval } = settings

  const setFolder = (h: SshHost, folder: string): void => {
    if (folder === h.folder) return
    const next = { ...h, folder }
    update({
      sshHosts: hosts.map((x) => (x.id === h.id ? next : x)),
      projects: settings.projects.map((p) => (p.ssh?.hostId === h.id ? { ...p, path: sshDisplay(next) } : p))
    })
  }

  const remove = (h: SshHost): void => {
    const pid = `ssh-${h.id}`
    const projects = settings.projects.filter((p) => p.ssh?.hostId !== h.id)
    disposeTerminal(pid)
    update({
      sshHosts: hosts.filter((x) => x.id !== h.id),
      projects,
      activeProjectId: settings.activeProjectId === pid ? (projects[projects.length - 1]?.id ?? null) : settings.activeProjectId
    })
  }

  return (
    <>
      <label className="pop-check">
        <input type="checkbox" checked={sshKeepalive} onChange={() => update({ sshKeepalive: !sshKeepalive })} />
        Keep SSH connections alive
      </label>
      <span className="pop-hint">
        Sends a ping from this computer so idle links are not dropped. It cannot stop a server that ends idle sessions on purpose.
      </span>
      {sshKeepalive && (
        <label className="pop-field">
          <span className="pop-hint">Seconds between pings (5 to 300)</span>
          <input
            className="pop-input"
            type="number"
            min={5}
            max={300}
            defaultValue={sshKeepaliveInterval}
            onBlur={(e) => {
              const n = Math.min(300, Math.max(5, Math.round(Number(e.target.value) || 30)))
              e.target.value = String(n)
              if (n !== sshKeepaliveInterval) update({ sshKeepaliveInterval: n })
            }}
          />
          <span className="pop-hint">Applies to new connections.</span>
        </label>
      )}
      {hosts.map((h) => (
        <div key={h.id} className="secret-row">
          <span className="mono veil">{h.label}</span>
          <input
            className="pop-input veil"
            spellCheck={false}
            placeholder="start folder"
            aria-label={`Start folder for ${h.label}`}
            defaultValue={h.folder}
            onBlur={(e) => setFolder(h, e.target.value.trim())}
          />
          <span />
          <ConfirmButton label="Remove" onConfirm={() => remove(h)} />
        </div>
      ))}
      {hosts.length === 0 && <span className="pop-hint">Saved hosts show up here after you open one.</span>}
    </>
  )
}
