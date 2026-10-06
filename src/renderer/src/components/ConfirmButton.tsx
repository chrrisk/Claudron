import { useEffect, useRef, useState } from 'react'

/** Two-step destructive button: first click arms it, second click within 3s confirms. */
export function ConfirmButton({
  label,
  onConfirm,
  className = 'link-btn'
}: {
  label: string
  onConfirm: () => void
  className?: string
}): React.JSX.Element {
  const [armed, setArmed] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <button
      className={className}
      style={armed ? { color: 'var(--ssh-blood, #ff5a6a)', fontWeight: 700 } : undefined}
      onBlur={() => setArmed(false)}
      onClick={() => {
        window.clearTimeout(timer.current)
        if (armed) {
          setArmed(false)
          onConfirm()
          return
        }
        setArmed(true)
        timer.current = window.setTimeout(() => setArmed(false), 3000)
      }}
    >
      {armed ? 'Sure?' : label}
    </button>
  )
}
