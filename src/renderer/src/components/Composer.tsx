import { useEffect, useRef, useState } from 'react'
import type { Project, ClaudronPermissionMode } from '@shared/settings'
import { interrupt, sendPrompt, useAgent } from '../store/agent'
import { useSettings } from '../store/settings'
import { useHaunt } from '../lib/haunt'
import { SendIcon, StopIcon } from './icons'

// shift+tab cycles like the CLI does. Unleashed is never one keystroke away.
const CYCLE: ClaudronPermissionMode[] = ['ask', 'acceptEdits', 'plan']

export function Composer({ project }: { project: Project }): React.JSX.Element {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const busy = useAgent((s) => s.convs[project.id]?.busy ?? false)
  const mode = useSettings((s) => s.settings.permissionMode)
  const update = useSettings((s) => s.update)
  const { copy } = useHaunt()

  useEffect(() => ref.current?.focus(), [project.id])

  // Grow with content up to ~8 lines.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  const submit = (): void => {
    const t = text.trim()
    if (!t) return
    setText('')
    void sendPrompt(project, t, mode)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape' && busy) {
      e.preventDefault()
      interrupt(project.id)
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      const i = CYCLE.indexOf(mode)
      update({ permissionMode: CYCLE[(i + 1) % CYCLE.length] })
    }
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        <label className="composer-field">
          <span className="sr-only">Message Claude</span>
          <textarea
            ref={ref}
            rows={2}
            value={text}
            placeholder={copy.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="composer-hints">
            <span>/ commands</span>
            <span>@ files</span>
            <span className={mode === 'plan' ? 'on' : ''}>shift+tab {mode === 'plan' ? 'plan on' : 'plan'}</span>
            {busy && <span>esc stop</span>}
          </span>
        </label>
        {busy && !text.trim() ? (
          <button className="send-btn stop" aria-label="Stop" onClick={() => interrupt(project.id)}>
            <StopIcon />
          </button>
        ) : (
          <button className="send-btn" aria-label="Send" onClick={submit} disabled={!text.trim()}>
            <SendIcon />
          </button>
        )}
      </div>
    </div>
  )
}
