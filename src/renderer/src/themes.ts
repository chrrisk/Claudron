import type { Theme } from '@shared/settings'

/** Lifted from tokens() in docs/mockups/Main.dc.html. Keep the two in sync. */
export interface ThemeTokens {
  bg: string
  chrome: string
  panel: string
  panel2: string
  term: string
  line: string
  lineStrong: string
  fg: string
  muted: string
  accent: string
  accentInk: string
  accentSoft: string
  glow: string
  violet: string
  ok: string
  okSoft: string
  bad: string
  badSoft: string
  warn: string
  danger: string
  calm: string
  grid: string
  web: string
  userBubble: string
  fog: string
  bat: string
  moon: string
  moonCrater: string
  art: string
  pot: string
  potEdge: string
  liquidTop: string
}

export const THEMES: Record<Theme, ThemeTokens> = {
  light: {
    bg: '#efe8dc', chrome: '#e7dfd0', panel: '#f8f3ea', panel2: '#efe7d8', term: '#f6f0e5',
    line: '#d6cab5', lineStrong: '#b9aa90', fg: '#1d1526', muted: '#5f5468',
    accent: '#b44700', accentInk: '#fff8f0', accentSoft: 'rgba(180,71,0,0.08)', glow: 'rgba(180,71,0,0.22)',
    violet: '#5a2fc2', ok: '#1d7344', okSoft: 'rgba(29,115,68,0.08)', bad: '#b3203a', badSoft: 'rgba(179,32,58,0.07)',
    warn: '#b44700', danger: '#b3203a', calm: '#1d7344',
    grid: 'rgba(90,47,194,0.05)', web: 'rgba(29,21,38,0.35)', userBubble: '#ece2f8',
    fog: 'rgba(110,90,130,0.16)', bat: '#1d1526', moon: '#1d1526', moonCrater: '#e7dfd0',
    art: '#2a1d3d', pot: '#2b2233', potEdge: '#1d1526', liquidTop: '#ffffff'
  },
  dark: {
    bg: '#0c0a11', chrome: '#100d16', panel: '#14111c', panel2: '#1b1726', term: '#08070c',
    line: '#2a2338', lineStrong: '#3d3350', fg: '#ede7f6', muted: '#9c91b0',
    accent: '#ff8a3d', accentInk: '#1a0c02', accentSoft: 'rgba(255,138,61,0.08)', glow: 'rgba(255,138,61,0.32)',
    violet: '#b79cff', ok: '#7ee0a1', okSoft: 'rgba(126,224,161,0.07)', bad: '#ff7088', badSoft: 'rgba(255,112,136,0.07)',
    warn: '#ff8a3d', danger: '#ff5370', calm: '#7ee0a1',
    grid: 'rgba(183,156,255,0.045)', web: 'rgba(237,231,246,0.22)', userBubble: '#221b30',
    fog: 'rgba(205,195,235,0.085)', bat: '#cfc4e6', moon: '#f3ead2', moonCrater: '#c9bd9c',
    art: '#1d1530', pot: '#07060b', potEdge: '#3d3350', liquidTop: '#ffffff'
  }
}

const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

/** Emits `:root[data-theme="x"] { --bg: ...; }` blocks for every theme. */
export function themeCss(): string {
  return (Object.keys(THEMES) as Theme[])
    .map((name) => {
      const vars = Object.entries(THEMES[name])
        .map(([k, v]) => `--${kebab(k)}:${v};`)
        .join('')
      return `:root[data-theme="${name}"]{${vars}color-scheme:${name};}`
    })
    .join('\n')
}

export function installThemeVars(): void {
  const el = document.createElement('style')
  el.id = 'claudron-theme-vars'
  el.textContent = themeCss()
  document.head.prepend(el)
}

export const FONT_FAMILIES = {
  chakra: "'Chakra Petch', 'Segoe UI', system-ui, sans-serif",
  excali: "'Excalifont', 'Chakra Petch', 'Segoe UI', sans-serif"
} as const

export const MONO = "'JetBrains Mono', ui-monospace, 'Cascadia Mono', Menlo, monospace"
