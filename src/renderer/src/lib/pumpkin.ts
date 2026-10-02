import type { HauntLevel } from '@shared/settings'

const PUMPKIN = ["      ,", "   .-'|'-.", '  / /\\ /\\ \\', ' |    /\\   |', '  \\ \\/\\/\\/ /', "   '-.__.-'"]

const ORANGE = '\x1b[1;38;2;255;138;61m'
const ORANGE_LIGHT = '\x1b[1;38;2;180;71;0m'
const VIOLET = '\x1b[38;2;183;156;255m'
const VIOLET_LIGHT = '\x1b[38;2;90;47;194m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

/**
 * Printed into the terminal before claude starts, so it scrolls away like
 * normal output. Subtle gets a one-line header instead.
 */
export function bannerFor(level: HauntLevel, opts: { dir: string; branch: string | null; light: boolean }): string {
  const where = [opts.dir, opts.branch].filter(Boolean).join(' · ')
  if (level === 'subtle') {
    return `${DIM}wraith ▸ claude   ${RESET}${opts.dir}${DIM}   ${opts.branch ?? ''}${RESET}\r\n\r\n`
  }
  const accent = opts.light ? ORANGE_LIGHT : ORANGE
  const violet = opts.light ? VIOLET_LIGHT : VIOLET
  const side = [
    `${BOLD}W R A I T H${RESET}`,
    `${DIM}claude · ${where}${RESET}`,
    level === 'full' ? `${violet}/\\^._.^/\\   the bats are out tonight${RESET}` : ''
  ]
  const width = Math.max(...PUMPKIN.map((l) => l.length))
  const lines = PUMPKIN.map((art, i) => {
    const text = i >= 1 && i <= 3 ? side[i - 1] : ''
    return `${accent}${art.padEnd(width)}${RESET}    ${text}`
  })
  return lines.join('\r\n') + '\r\n\r\n'
}
