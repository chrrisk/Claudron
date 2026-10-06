/** Idle tea lights and a tiny pumpkin tucked in the corners of the terminal. Decor only. */
function TeaLight({ className }: { className: string }): React.JSX.Element {
  return (
    <span className={`glow tea ${className}`} aria-hidden="true">
      <span className="flame" data-anim="flicker" />
      <span className="cup" />
    </span>
  )
}

function MiniPumpkin({ className }: { className: string }): React.JSX.Element {
  return (
    <svg className={`glow pump ${className}`} width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
      <g data-anim="flicker">
        <ellipse cx="8" cy="8.5" rx="7" ry="5.2" fill="var(--ssh-pumpkin)" opacity="0.9" />
        <path d="M7 3.6 C7 2.2 8.8 1.6 9.6 1" stroke="var(--ssh-slime)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M4.6 7.4 6 6.2 6.9 7.6Z M9.1 7.6 10 6.2 11.4 7.4Z" fill="#2a1500" />
        <path d="M5.2 10 6.6 9.2 8 10.2 9.4 9.2 10.8 10 9.6 11.2H6.4Z" fill="#2a1500" />
      </g>
    </svg>
  )
}

export function Glow(): React.JSX.Element {
  return (
    <>
      <TeaLight className="tl-a" />
      <TeaLight className="tl-b" />
      <MiniPumpkin className="pk-a" />
    </>
  )
}
