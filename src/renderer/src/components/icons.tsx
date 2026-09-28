import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

/** Hexagon jack-o'-lantern. */
export function LogoMark(props: P & { size?: number }): React.JSX.Element {
  const { size = 22, ...rest } = props
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...rest}>
      <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M7.5 10.5l3 1.5-3 1z" fill="var(--accent)" />
      <path d="M16.5 10.5l-3 1.5 3 1z" fill="var(--accent)" />
      <path d="M8.5 16q3.5 2 7 0" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function PlusIcon(props: P): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CloseIcon(props: P): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function MoonIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="var(--moon)" />
      <circle cx="9" cy="10" r="1.8" fill="var(--moon-crater)" />
      <circle cx="14.5" cy="14.5" r="2.4" fill="var(--moon-crater)" />
      <circle cx="15" cy="8.5" r="1" fill="var(--moon-crater)" />
    </svg>
  )
}

export function SunriseIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M2 18h20" />
      <path d="M7 18a5 5 0 0 1 10 0" />
      <path d="M12 6v3M5.6 10.6l1.4 1.4M18.4 10.6L17 12M2 14h2M20 14h2" />
    </svg>
  )
}

export function GearIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

export function FileIcon(props: P): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

export function PencilIcon(props: P): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

export function TerminalIcon(props: P): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 17l6-5-6-5M12 19h8" />
    </svg>
  )
}

export function SearchIcon(props: P): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

export function ToolIcon(props: P): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
    </svg>
  )
}

export function SendIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

export function StopIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

export function BellIcon(props: P): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

export function TombstoneIcon(): React.JSX.Element {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M2 21V8a7 7 0 0 1 14 0v13z" fill="none" stroke="var(--muted)" strokeWidth="1.5" />
      <path d="M9 6v7M6 9h6" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M0 21h18" stroke="var(--muted)" strokeWidth="1.5" />
    </svg>
  )
}

export function GhostIcon(props: P): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 21V10a7 7 0 0 1 14 0v11l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2z" />
      <circle cx="9.5" cy="10" r="1" fill="currentColor" />
      <circle cx="14.5" cy="10" r="1" fill="currentColor" />
    </svg>
  )
}

export const BAT_PATH =
  'M12 4L12.8 2.2 13.4 4.2Q16 3 18 1Q19 4 24 4Q21 5 21 8Q19 6.5 17 8Q15 6.5 13.5 9L12 11 10.5 9Q9 6.5 7 8Q5 6.5 3 8Q3 5 0 4Q5 4 6 1Q8 3 10.6 4.2L11.2 2.2z'

export function Bat({ width, style, ...rest }: P & { width: number }): React.JSX.Element {
  return (
    <svg width={width} height={width / 2} viewBox="0 0 24 12" aria-hidden="true" style={style} {...rest}>
      <path d={BAT_PATH} fill="var(--bat)" />
    </svg>
  )
}
