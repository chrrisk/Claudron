export interface SshHost {
  id: string
  /** ssh alias, user@host or user@host:port */
  target: string
  label: string
  /** Start folder on the remote. Empty means the home directory. */
  folder: string
}

export interface SecretMeta {
  id: string
  name: string
  /** 'all' or an SshHost id */
  scope: string
}

const TARGET_RE = /^(?:[A-Za-z0-9][A-Za-z0-9._-]*@)?[A-Za-z0-9][A-Za-z0-9._-]*(?::(\d{1,5}))?$/

/** Strict on purpose: the target goes to ssh as an argument, so it must never look like an option. */
export function isValidTarget(t: string): boolean {
  const m = TARGET_RE.exec(t)
  if (!m) return false
  return m[1] === undefined || Number(m[1]) <= 65535
}

export function splitTarget(t: string): { host: string; port: number | null } {
  const m = /^(.*):(\d{1,5})$/.exec(t)
  return m ? { host: m[1], port: Number(m[2]) } : { host: t, port: null }
}

export function hostIdFor(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function hostLabel(t: string): string {
  return splitTarget(t).host.split('@').pop() ?? t
}

export function sshDisplay(h: SshHost): string {
  return `${h.target}:${h.folder || '~'}`
}

/** POSIX single-quote escaping. */
export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

export interface SshArgOpts {
  /** user@host, port already split off */
  host: string
  port: number | null
  keepalive: boolean
  interval: number
  bridge?: { remote: number; local: number }
  remoteCommand: string
}

export function buildSshArgs(o: SshArgOpts): string[] {
  const args = ['-tt']
  if (o.keepalive) {
    const interval = Math.min(300, Math.max(5, Math.round(o.interval)))
    args.push('-o', `ServerAliveInterval=${interval}`, '-o', 'ServerAliveCountMax=4', '-o', 'TCPKeepAlive=yes')
  }
  if (o.port) args.push('-p', String(o.port))
  if (o.bridge) {
    args.push('-o', 'ExitOnForwardFailure=no', '-R', `127.0.0.1:${o.bridge.remote}:127.0.0.1:${o.bridge.local}`)
  }
  args.push('--', o.host, o.remoteCommand)
  return args
}

/** Runs on the remote. Holds the port and a per-session token, never the secret. */
export function buildAskpassScript(port: number, token: string): string {
  const inner =
    `exec 3<>/dev/tcp/127.0.0.1/${port} || exit 1; ` +
    `printf '%s\\tSUDO\\n' ${shQuote(token)} >&3; ` +
    `IFS= read -r l <&3; [ -n "$l" ] || exit 1; printf '%s\\n' "$l"`
  return `#!/bin/sh\nexec bash -c ${shQuote(inner)}\n`
}

export interface RemoteScriptOpts {
  folder: string
  claudeArgs: string[]
  sessionId: string
  askpass?: { port: number; token: string }
}

function folderExpr(raw: string): string | null {
  const f = raw.trim()
  if (!f) return null
  if (f === '~') return '"$HOME"'
  if (f.startsWith('~/')) return `"$HOME"/${shQuote(f.slice(2))}`
  return shQuote(f)
}

/** The /bin/sh script that sets up the remote session and execs claude. */
export function buildRemoteScript(o: RemoteScriptOpts): string {
  const lines: string[] = []
  if (o.askpass) {
    const file = `"$HOME/.claudron/askpass-${o.sessionId.replace(/[^a-zA-Z0-9]/g, '')}"`
    const b64 = btoa(buildAskpassScript(o.askpass.port, o.askpass.token))
    lines.push(
      `mkdir -p "$HOME/.claudron" && (umask 077; printf %s ${b64} | base64 -d > ${file}) && chmod 700 ${file} && export SUDO_ASKPASS=${file}`
    )
  }
  const cd = folderExpr(o.folder)
  if (cd) lines.push(`cd ${cd} || echo "claudron: could not open that folder, staying in home" >&2`)
  const claude = `exec ${['claude', ...o.claudeArgs].map(shQuote).join(' ')}`
  lines.push(`exec "\${SHELL:-sh}" -lc ${shQuote(claude)}`)
  return lines.join('\n')
}

/** One argument, no quoting hazards: base64 is [A-Za-z0-9+/=] only. */
export function buildRemoteCommand(script: string): string {
  return `sh -c "$(echo ${btoa(script)} | base64 -d)"`
}

export const SUDO_NOTE =
  'Claudron note: a sudo password is stored for this host. Run privileged commands as `sudo -A <command>`. ' +
  'Never ask the user for the password and never try to read it.'

/** Host-scoped secrets win over "all". */
export function pickSecret<T extends SecretMeta>(items: T[], name: string, hostId: string): T | null {
  const n = name.toLowerCase()
  const hits = items.filter((i) => i.name.toLowerCase() === n && (i.scope === 'all' || i.scope === hostId))
  return hits.find((i) => i.scope === hostId) ?? hits[0] ?? null
}

/** Returns an error message, or null when fine. */
export function validateSecretInput(name: string, value: string): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name)) return 'Name must be letters, numbers or underscores.'
  if (value.length === 0) return 'The value is empty.'
  if (/[\r\n]/.test(value)) return 'Secrets cannot contain a new line.'
  if (value.length > 512) return 'That value is too long (512 characters max).'
  return null
}
