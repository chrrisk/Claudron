import { useState } from 'react'
import { AGENT_NOTE_MAX } from '@shared/notes'
import { useSettings } from '../store/settings'
import { restartAllTerminals } from '../lib/terminals'

export function AgentNoteSettings(): React.JSX.Element {
  const note = useSettings((s) => s.settings.agentNote)
  const mode = useSettings((s) => s.settings.permissionMode)
  const update = useSettings((s) => s.update)
  const [draft, setDraft] = useState(note)
  const dirty = draft.trim() !== note.trim()

  return (
    <>
      <span className="pop-hint">
        Something to tell every Claude on every run. A "for the record" note: house rules, your setup, things to never do.
      </span>
      <textarea
        className="pop-input agent-note"
        rows={4}
        maxLength={AGENT_NOTE_MAX}
        spellCheck
        placeholder="e.g. I use pnpm, not npm. Never push to main."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="note-actions">
        <span className="pop-hint">
          {draft.length}/{AGENT_NOTE_MAX} · applies to new sessions
        </span>
        <button className="ssh-btn primary" disabled={!dirty} onClick={() => update({ agentNote: draft.trim() })}>
          Save note
        </button>
        <button
          className="ssh-btn"
          disabled={dirty || !note}
          title="Restart running sessions so they pick up the note (--continue keeps the conversation)"
          onClick={() => void restartAllTerminals(mode)}
        >
          Apply now
        </button>
      </div>
    </>
  )
}
