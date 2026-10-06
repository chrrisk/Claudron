import { useSyncExternalStore } from 'react'
import { getTerminal, subscribeTerminals } from '../lib/terminals'
import { useHaunt } from '../lib/haunt'
import { useSetting } from '../store/settings'
import { isHalloween, isWitchingHour } from '@shared/eggs'

export function HostChip(): React.JSX.Element {
  const { spooky } = useHaunt()
  return <span className={`host-chip ${spooky && isHalloween(new Date()) ? 'hallow' : ''}`}>SSH</span>
}

export function SshDot({ id }: { id: string }): React.JSX.Element {
  const status = useSyncExternalStore(subscribeTerminals, () => getTerminal(id)?.status ?? 'idle')
  const keepalive = useSetting('sshKeepalive')
  const interval = useSetting('sshKeepaliveInterval')
  const { spooky, still } = useHaunt()
  const state = status === 'running' ? 'on' : status === 'exited' || status === 'error' ? 'lost' : 'wait'
  const flicker = spooky && !still && state === 'on' && isWitchingHour(new Date())
  const label = state === 'on' ? 'Connected' : state === 'lost' ? 'Connection lost' : 'Connecting'
  return (
    <span
      className={`ssh-dot ${state} ${keepalive && !still ? 'ka' : ''} ${flicker ? 'flicker' : ''}`}
      style={{ ['--ka' as string]: `${interval}s` }}
      title={label}
      role="img"
      aria-label={label}
    />
  )
}
