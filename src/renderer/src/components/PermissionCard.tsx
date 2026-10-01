import { useEffect, useRef } from 'react'
import type { PermissionDecision, PermissionRequest } from '@shared/agent'
import { useHaunt } from '../lib/haunt'
import { Markdown } from './Markdown'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** What Claude wants to do, in one line of code. */
export function permissionSubject(req: PermissionRequest): { verb: string; subject: string } {
  const i = req.input
  switch (req.toolName) {
    case 'Bash':
      return { verb: 'run', subject: str(i.command) }
    case 'Edit':
    case 'MultiEdit':
      return { verb: 'edit', subject: str(i.file_path) }
    case 'Write':
      return { verb: 'write', subject: str(i.file_path) }
    case 'WebFetch':
      return { verb: 'fetch', subject: str(i.url) }
    case 'WebSearch':
      return { verb: 'search the web for', subject: str(i.query) }
    case 'ExitPlanMode':
      return { verb: 'start on this plan', subject: '' }
    default:
      return { verb: 'use', subject: req.toolName.replace(/^mcp__/, '').replace(/__/g, ' · ') }
  }
}

interface Props {
  request: PermissionRequest
  cwd: string
  /** Only the first waiting card listens for the 1/2/3 keys. */
  active: boolean
  onDecide: (d: PermissionDecision) => void
}

export function PermissionCard({ request, cwd, active, onDecide }: Props): React.JSX.Element {
  const { copy, spooky, still } = useHaunt()
  const denyRef = useRef<HTMLButtonElement>(null)
  const { verb, subject: raw } = permissionSubject(request)
  const subject = cwd && raw.startsWith(cwd + '/') ? raw.slice(cwd.length + 1) : raw
  const keys = !request.defaultToNo

  useEffect(() => {
    if (!active) return
    if (request.defaultToNo) denyRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (!keys || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') && (t as HTMLInputElement).value !== ''
      if (typing) return
      const map: Record<string, PermissionDecision> = { '1': 'once', '2': 'always', '3': 'deny' }
      const d = map[e.key]
      if (!d || (d === 'always' && !request.canAlwaysAllow)) return
      e.preventDefault()
      onDecide(d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, keys, request, onDecide])

  // "Claude is at the door and wants to run" only reads right for commands.
  const lead = verb === 'run' ? copy.permLead : copy.permLead.replace(/run$/, verb)
  const plan = request.toolName === 'ExitPlanMode' ? str(request.input.plan) : ''

  return (
    <div className="perm-card" role="alertdialog" aria-label={`${copy.permTag}: ${lead} ${subject}`}>
      <div className="perm-glow" data-anim="flicker" aria-hidden="true" style={{ animation: spooky && !still ? undefined : 'none' }} />
      <div className="perm-line">
        <span className="perm-tag">{copy.permTag}</span>
        <span>{lead}</span>
        {subject && <code className="perm-subject">{subject}</code>}
      </div>
      {request.description && !raw.endsWith(request.description) && <div className="perm-desc">{request.description}</div>}
      {plan && (
        <div className="perm-plan">
          <Markdown text={plan} />
        </div>
      )}
      <div className="perm-actions">
        <button className="perm-btn primary" onClick={() => onDecide('once')}>
          {copy.allowOnce} {keys && <span className="key">1</span>}
        </button>
        {request.canAlwaysAllow && (
          <button className="perm-btn" onClick={() => onDecide('always')}>
            {copy.allowAlways} {keys && <span className="key">2</span>}
          </button>
        )}
        <button ref={denyRef} className="perm-btn ghost" onClick={() => onDecide('deny')}>
          {copy.deny} {keys && <span className="key">3</span>}
        </button>
      </div>
    </div>
  )
}
