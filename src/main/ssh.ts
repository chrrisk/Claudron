import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, delimiter, dirname, isAbsolute, join } from 'node:path'
import { parseSshConfig } from '@shared/ssh-config'

export function findInPath(names: string[], pathEnv: string, exists: (p: string) => boolean = existsSync): string | null {
  for (const dir of pathEnv.split(delimiter).filter(Boolean)) {
    for (const n of names) {
      const p = join(dir, n)
      if (exists(p)) return p
    }
  }
  return null
}

export function findSsh(): string | null {
  const win = process.platform === 'win32'
  const found = findInPath(win ? ['ssh.exe'] : ['ssh'], process.env['PATH'] ?? '')
  if (found) return found
  if (win) {
    const sys = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'OpenSSH', 'ssh.exe')
    return existsSync(sys) ? sys : null
  }
  return existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : null
}

const escapeRe = (s: string): string => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

/** Host aliases from ~/.ssh/config, following Include. Never throws. */
export function readConfigHosts(sshDir = join(homedir(), '.ssh')): string[] {
  const read = (p: string): string => {
    try {
      return readFileSync(p, 'utf8')
    } catch {
      return ''
    }
  }
  const include = (pattern: string): string[] => {
    const expanded = pattern.startsWith('~/') ? join(homedir(), pattern.slice(2)) : pattern
    const abs = isAbsolute(expanded) ? expanded : join(sshDir, expanded)
    const base = basename(abs)
    if (!base.includes('*')) return [read(abs)]
    const re = new RegExp(`^${base.split('*').map(escapeRe).join('.*')}$`)
    try {
      return readdirSync(dirname(abs))
        .filter((f) => re.test(f))
        .sort()
        .map((f) => read(join(dirname(abs), f)))
    } catch {
      return []
    }
  }
  return parseSshConfig(read(join(sshDir, 'config')), include)
}
