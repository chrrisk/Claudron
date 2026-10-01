import { useEffect, useRef } from 'react'

export function UnleashedWarning({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }): React.JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal danger" role="alertdialog" aria-labelledby="unleash-title" aria-describedby="unleash-body">
        <span className="unleashed-badge">UNLEASHED</span>
        <h2 id="unleash-title">Let Claude run without asking?</h2>
        <div id="unleash-body" className="modal-body">
          <p>
            Unleashed skips every permission prompt. Claude can run any shell command, edit or delete any file it can
            reach, and hit the network, all without checking with you first.
          </p>
          <p>
            This is the same as <code>--dangerously-skip-permissions</code>. Use it in a sandbox, a container, or a repo
            you can throw away.
          </p>
        </div>
        <div className="modal-actions">
          <button ref={cancelRef} className="ghost-btn" onClick={onCancel}>
            Keep asking
          </button>
          <button className="danger-btn" onClick={onConfirm}>
            Unleash it
          </button>
        </div>
      </div>
    </div>
  )
}
