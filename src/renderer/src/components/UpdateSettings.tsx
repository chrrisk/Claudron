import { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/update'

export function UpdateSettings(): React.JSX.Element {
  const [state, setState] = useState<UpdateState>({ kind: 'idle' })
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.claudron.invoke('app:info').then((i) => setVersion(i.version))
    void window.claudron.invoke('update:get').then(setState)
    return window.claudron.on('update:state', setState)
  }, [])

  const busy = state.kind === 'checking' || state.kind === 'downloading'
  const line =
    state.kind === 'checking'
      ? 'Checking GitHub...'
      : state.kind === 'none'
        ? 'You have the latest version.'
        : state.kind === 'downloading'
          ? `Downloading ${state.version} (${state.percent}%)`
          : state.kind === 'ready'
            ? `${state.version} is ready.`
            : state.kind === 'error'
              ? `Update failed: ${state.message}`
              : state.kind === 'unsupported'
                ? state.reason
                : 'Checks GitHub for a newer release. Nothing installs until you say so.'

  return (
    <>
      {state.kind === 'ready' ? (
        <button className="ssh-btn primary" onClick={() => void window.claudron.invoke('update:install')}>
          Restart and update
        </button>
      ) : (
        <button className="ssh-btn" disabled={busy} onClick={() => void window.claudron.invoke('update:check')}>
          Check for updates
        </button>
      )}
      <span className="pop-hint">
        {version && `v${version} · `}
        {line}
      </span>
    </>
  )
}
