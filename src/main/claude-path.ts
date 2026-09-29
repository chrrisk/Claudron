import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require_ = createRequire(__filename)
const isWin = process.platform === 'win32'

export interface ClaudeBinary {
  /** Absolute path to the executable (or .cmd shim on Windows). */
  path: string
  /** Where we found it, shown in the UI when something goes wrong. */
  source: 'path' | 'known-location' | 'bundled'
}

function candidatesOnPath(): string[] {
  const names = isWin ? ['claude.exe', 'claude.cmd'] : ['claude']
  const dirs = (process.env['PATH'] ?? '').split(delimiter).filter(Boolean)
  return dirs.flatMap((d) => names.map((n) => join(d, n)))
}

function knownLocations(): string[] {
  const home = homedir()
  if (isWin) {
    const appData = process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming')
    return [
      join(home, '.local', 'bin', 'claude.exe'),
      join(appData, 'npm', 'claude.cmd'),
      join(home, '.claude', 'local', 'claude.exe')
    ]
  }
  return [
    join(home, '.local', 'bin', 'claude'),
    join(home, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    join(home, '.npm-global', 'bin', 'claude'),
    join(home, '.bun', 'bin', 'claude')
  ]
}

/**
 * The Agent SDK ships a native Claude Code binary per platform. If the user
 * has never installed the CLI we can still run that one.
 */
export function bundledClaude(): string | null {
  const pkg = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`
  try {
    const dir = dirname(require_.resolve(`${pkg}/package.json`))
    // Packaged builds keep native binaries outside the asar archive.
    const bin = join(dir, isWin ? 'claude.exe' : 'claude').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
    return existsSync(bin) ? bin : null
  } catch {
    return null
  }
}

export function findClaude(): ClaudeBinary | null {
  for (const p of candidatesOnPath()) if (existsSync(p)) return { path: p, source: 'path' }
  for (const p of knownLocations()) if (existsSync(p)) return { path: p, source: 'known-location' }
  const b = bundledClaude()
  return b ? { path: b, source: 'bundled' } : null
}

/**
 * node-pty on Windows can only exec real binaries, so .cmd shims (npm installs)
 * go through cmd.exe.
 */
export function spawnTarget(bin: string, args: string[]): { file: string; args: string[] } {
  if (isWin && /\.(cmd|bat)$/i.test(bin)) {
    return { file: process.env['ComSpec'] ?? 'cmd.exe', args: ['/d', '/s', '/c', bin, ...args] }
  }
  return { file: bin, args }
}
