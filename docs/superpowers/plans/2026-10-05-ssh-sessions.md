# SSH sessions, keepalive and secrets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open a Claude Code session over SSH from Claudron (CLI mode), keep the connection alive client side, and let Claude use a stored sudo password it can never read.

**Architecture:** An SSH session is a normal Claudron project tab carrying `ssh: { hostId }`. Main builds `ssh -tt ... -- sh -c "<base64 script>"` and runs it in the existing node-pty path; the script `cd`s, optionally installs a secret-free askpass helper, and execs `claude` through the remote login shell. Secrets live encrypted (`safeStorage`) in main only. A per-session loopback TCP bridge, reverse-forwarded with `ssh -R`, lets the remote askpass helper fetch the sudo password on demand.

**Tech Stack:** Electron main (node `net`, `crypto`, `safeStorage`), node-pty, React + zustand renderer, vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-ssh-sessions-design.md`

## Deviations from the spec (decided while planning)

- Secrets UI is sudo-password only (fixed name `SUDO`, choose "Use on"). The data model stays generic, but arbitrary env-style secrets would leak via `echo`, so no UI for them.
- No Summon-menu split. The sidebar only exists in UI mode and SSH is CLI-only. Entry point is an "Open over SSH" button next to the project `+` in the title bar.
- Keepalive is global (toggle plus interval), no per-host override.
- Added after the spec: a "For the record" note in Settings (`agentNote`), appended to every Claude session's system prompt, local and SSH. Single `--append-system-prompt` flag, merged with the sudo note.
- Halloween "pumpkin drop in sidebar" egg dropped (no sidebar in CLI mode). Candy-corn chip stays.
- Askpass helper needs `bash` on the remote (uses `/dev/tcp`). The remote login shell must be POSIX-like or fish 3.4+.

## Global Constraints

- Never use em dashes in UI copy, docs, comments or commits. Use `-` or `·`.
- Dark mode and UI mode are defaults. SSH sessions force CLI view; all other settings stay shared.
- The usage cauldron never estimates. SSH sessions get no local `--settings` tap, so they show NO READING.
- Every animation must respect `prefers-reduced-motion`.
- No secrets in the repo. Secret values only in Electron `safeStorage`, never sent to the renderer after save.
- Keep the main process thin; renderer talks to it through the typed preload bridge (`src/shared/ipc.ts` maps; both allowlists must be updated).
- Work in order. Finish and verify each task (app launches, feature works) before the next.
- Windows and macOS both supported. Use the system `ssh` binary; never type SSH passwords for the user.

## Review Focus

- Host target beginning with `-`, containing spaces or shell characters (`-oProxyCommand=x`, `a;rm`) must be rejected, never reach `ssh` as an option. (Task 1)
- Start folder with spaces, quotes, `$(...)`, or `~/` must reach the remote `cd` intact and expand `~` correctly. (Task 1)
- Secret containing `'`, `"`, `$`, backslash must arrive byte-exact; a newline in a secret is rejected at save. (Tasks 1 and 6)
- Bridge must refuse wrong token, unknown secret name, host-scope mismatch, oversize or stalled requests, and stop listening when the session ends. (Task 6)
- `ssh` missing from PATH, missing/unreadable `~/.ssh/config`, or an `Include` loop must give a clear error or an empty list, never a crash or hang. (Tasks 1 and 2)
- Reconnect with `--continue` when the remote has no conversation yet must offer "Start fresh". (Task 4)
- "For the record" note that is empty, whitespace, huge, or contains quotes/newlines must yield no flag or one intact flag, never break the command line. (Tasks 1 and 8)

## File Structure

| File | Responsibility |
|---|---|
| `src/shared/ssh.ts` (new) | Types, target validation, quoting, ssh args, remote script, secret scoping/validation. Pure. |
| `src/shared/ssh-config.ts` (new) | Parse `~/.ssh/config` host aliases. Pure. |
| `src/shared/eggs.ts` (new) | Date and name gated easter egg predicates. Pure. |
| `src/shared/notes.ts` (new) | `composeNotes`: merges the "for the record" note and Claudron notes into one `--append-system-prompt`. Pure. |
| `src/shared/settings.ts` | `Project.ssh`, `sshHosts`, `sshKeepalive`, `sshKeepaliveInterval`. |
| `src/shared/pty.ts`, `src/shared/ipc.ts` | `PtySpawnOptions.ssh`, new channels. |
| `src/main/ssh.ts` (new) | `findSsh`, `findInPath`, `readConfigHosts`. Node only, testable. |
| `src/main/ssh-bridge.ts` (new) | Loopback TCP askpass bridge. Node only, testable. |
| `src/main/secrets.ts` (new) | Encrypted secret store (`safeStorage`). |
| `src/main/ssh-session.ts` (new) | `prepareSsh`: assembles a spawn from settings, secrets, bridge. |
| `src/main/pty.ts` | Branch local vs ssh launch; session cleanup hook. |
| `src/renderer/src/lib/terminals.ts` | Carry `sshHostId`, `exitCode`; `reconnectTerminal`. |
| `src/renderer/src/components/{HostPicker,SshBadge,SshLost,SecretsSettings,RemoteSettings,SecretToast}.tsx` (new) | SSH UI. |
| `src/renderer/src/styles/ssh.css` (new) | Halloween SSH tokens and styles. |

---

### Task 1: Pure SSH core (types, validation, script builder, config parser)

**Files:**
- Create: `src/shared/ssh.ts`, `src/shared/ssh-config.ts`, `test/ssh.test.ts`, `test/ssh-config.test.ts`
- Modify: `src/shared/settings.ts`

**Interfaces:**
- Produces (all in `src/shared/ssh.ts`): `SshHost`, `SecretMeta`, `isValidTarget(t)`, `splitTarget(t)`, `hostIdFor(t)`, `hostLabel(t)`, `sshDisplay(h)`, `shQuote(s)`, `buildSshArgs(o)`, `buildAskpassScript(port, token)`, `buildRemoteScript(o)`, `buildRemoteCommand(script)`, `pickSecret(items, name, hostId)`, `validateSecretInput(name, value)`, `SUDO_NOTE`.
- Produces (`src/shared/ssh-config.ts`): `parseSshConfig(text, readInclude?)`.
- Produces (settings): `Project.ssh?: { hostId: string }`, `Settings.sshHosts: SshHost[]`, `sshKeepalive: boolean`, `sshKeepaliveInterval: number`.

- [ ] **Step 1: Write the failing tests for `ssh.ts`**

Create `test/ssh.test.ts`:

```ts
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  buildAskpassScript,
  buildRemoteCommand,
  buildRemoteScript,
  buildSshArgs,
  hostIdFor,
  hostLabel,
  isValidTarget,
  pickSecret,
  shQuote,
  splitTarget,
  validateSecretInput
} from '../src/shared/ssh'

describe('isValidTarget', () => {
  it('accepts aliases, user@host and host:port', () => {
    for (const t of ['devbox', 'chris@10.0.0.5', 'chris@my-host.example.com:2222', 'a.b-c_d']) {
      expect(isValidTarget(t), t).toBe(true)
    }
  })
  it('rejects option injection and shell characters', () => {
    for (const t of ['-oProxyCommand=x', '-p@host', 'a;rm -rf', 'a b', 'a$(x)', '', 'host:99999', '@host', 'host:']) {
      expect(isValidTarget(t), t).toBe(false)
    }
  })
})

describe('target helpers', () => {
  it('splits a port', () => {
    expect(splitTarget('u@h:2222')).toEqual({ host: 'u@h', port: 2222 })
    expect(splitTarget('devbox')).toEqual({ host: 'devbox', port: null })
  })
  it('makes ids and labels', () => {
    expect(hostIdFor('Chris@My.Host:22')).toBe('chris-my-host-22')
    expect(hostLabel('chris@my.host:22')).toBe('my.host')
    expect(hostLabel('devbox')).toBe('devbox')
  })
})

describe('buildSshArgs', () => {
  const base = { host: 'u@h', port: null, keepalive: true, interval: 30, remoteCommand: 'CMD' }
  it('adds keepalive options and ends options before the target', () => {
    const a = buildSshArgs(base)
    expect(a.slice(0, 1)).toEqual(['-tt'])
    expect(a).toContain('ServerAliveInterval=30')
    expect(a).toContain('ServerAliveCountMax=4')
    expect(a.slice(-3)).toEqual(['--', 'u@h', 'CMD'])
  })
  it('omits keepalive when off, clamps the interval, adds port and bridge', () => {
    expect(buildSshArgs({ ...base, keepalive: false })).not.toContain('ServerAliveInterval=30')
    expect(buildSshArgs({ ...base, interval: 1 })).toContain('ServerAliveInterval=5')
    expect(buildSshArgs({ ...base, interval: 9999 })).toContain('ServerAliveInterval=300')
    const a = buildSshArgs({ ...base, port: 2222, bridge: { remote: 40000, local: 51234 } })
    expect(a.join(' ')).toContain('-p 2222')
    expect(a.join(' ')).toContain('-R 127.0.0.1:40000:127.0.0.1:51234')
  })
})

describe('remote script', () => {
  const opts = { folder: '~/my dir/it\'s $(x)', claudeArgs: ['--permission-mode', 'default'], sessionId: 'ssh-box' }
  it('quotes the folder and expands ~', () => {
    const s = buildRemoteScript(opts)
    expect(s).toContain(`cd "$HOME"/${shQuote("my dir/it's $(x)")}`)
  })
  it('skips cd for an empty folder and goes through the login shell', () => {
    const s = buildRemoteScript({ ...opts, folder: '' })
    expect(s).not.toContain('cd ')
    expect(s).toContain('exec "${SHELL:-sh}" -lc ')
    expect(s).toContain(shQuote("exec 'claude' '--permission-mode' 'default'"))
  })
  it('installs the askpass helper only when asked, with no secret inside', () => {
    expect(buildRemoteScript(opts)).not.toContain('SUDO_ASKPASS')
    const s = buildRemoteScript({ ...opts, askpass: { port: 41000, token: 'abc123' } })
    expect(s).toContain('export SUDO_ASKPASS=')
    expect(s).toContain('umask 077')
    expect(buildAskpassScript(41000, 'abc123')).toContain('/dev/tcp/127.0.0.1/41000')
  })
  it('wraps the script as a base64 sh -c command', () => {
    const script = buildRemoteScript(opts)
    const cmd = buildRemoteCommand(script)
    const m = /^sh -c "\$\(echo (\S+) \| base64 -d\)"$/.exec(cmd)
    expect(m).not.toBeNull()
    expect(atob(m![1])).toBe(script)
  })
})

const hasSh = (() => {
  try {
    execFileSync('sh', ['-c', 'true'])
    return true
  } catch {
    return false
  }
})()

describe.skipIf(!hasSh)('shQuote round trip through a real sh', () => {
  it.each(["plain", "it's", 'a "b" $HOME `x` \\n', 'spaces and\ttabs', '$(touch /tmp/x)', ''])('%j', (s) => {
    expect(execFileSync('sh', ['-c', `printf %s ${shQuote(s)}`]).toString()).toBe(s)
  })
})

describe('pickSecret', () => {
  const items = [
    { id: '1', name: 'SUDO', scope: 'all' },
    { id: '2', name: 'SUDO', scope: 'devbox' },
    { id: '3', name: 'OTHER', scope: 'all' }
  ]
  it('prefers the host-specific one, falls back to all, ignores other hosts', () => {
    expect(pickSecret(items, 'sudo', 'devbox')?.id).toBe('2')
    expect(pickSecret(items, 'SUDO', 'other')?.id).toBe('1')
    expect(pickSecret(items.slice(1, 2), 'SUDO', 'other')).toBeNull()
    expect(pickSecret(items, 'MISSING', 'devbox')).toBeNull()
  })
})

describe('validateSecretInput', () => {
  it('accepts a sane secret and rejects bad ones', () => {
    expect(validateSecretInput('SUDO', `p'w"$x\\y`)).toBeNull()
    expect(validateSecretInput('SUDO', '')).toMatch(/empty/i)
    expect(validateSecretInput('SUDO', 'a\nb')).toMatch(/line/i)
    expect(validateSecretInput('SUDO', 'x'.repeat(513))).toMatch(/long/i)
    expect(validateSecretInput('bad name', 'x')).toMatch(/name/i)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/ssh.test.ts`
Expected: FAIL, cannot resolve `../src/shared/ssh`.

- [ ] **Step 3: Implement `src/shared/ssh.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/ssh.test.ts`
Expected: PASS (the real-`sh` block is skipped if `sh` is not on PATH).

- [ ] **Step 5: Write failing tests for the config parser**

Create `test/ssh-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseSshConfig } from '../src/shared/ssh-config'

describe('parseSshConfig', () => {
  it('lists concrete host aliases', () => {
    const text = `
# comment
Host devbox
  HostName 10.0.0.5
Host build prod # trailing comment
  User ci
host = quoted "weird"
Host *
  ServerAliveInterval 10
Host !bad foo?
Hostname not-a-host
`
    expect(parseSshConfig(text)).toEqual(['devbox', 'build', 'prod', 'quoted', 'weird'])
  })

  it('follows Include with a reader and survives include loops', () => {
    const files: Record<string, string> = { 'a.conf': 'Host from-a\nInclude loop.conf', 'loop.conf': 'Host from-loop\nInclude loop.conf' }
    const read = (p: string): string[] => (files[p] ? [files[p]] : [])
    expect(parseSshConfig('Include a.conf\nHost top', read).sort()).toEqual(['from-a', 'from-loop', 'top'])
  })

  it('returns nothing for empty text', () => {
    expect(parseSshConfig('')).toEqual([])
  })
})
```

- [ ] **Step 6: Run to verify it fails**, then implement `src/shared/ssh-config.ts`

Run: `npx vitest run test/ssh-config.test.ts` → FAIL (module missing).

```ts
/**
 * Concrete Host aliases from ssh_config text. Wildcard and negated patterns are skipped.
 * `readInclude` resolves an Include pattern to file bodies; loops stop at depth 4.
 */
export function parseSshConfig(
  text: string,
  readInclude: (pattern: string) => string[] = () => [],
  depth = 0
): string[] {
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    const m = /^(host|include)\s*(?:=|\s)\s*(.+)$/i.exec(line)
    if (!m) continue
    const args = m[2]
      .trim()
      .split(/\s+/)
      .map((a) => a.replace(/^"|"$/g, ''))
      .filter(Boolean)
    if (m[1].toLowerCase() === 'host') {
      for (const a of args) if (!/[*?!]/.test(a)) out.push(a)
    } else if (depth < 4) {
      for (const pat of args) for (const body of readInclude(pat)) out.push(...parseSshConfig(body, readInclude, depth + 1))
    }
  }
  return [...new Set(out)]
}
```

Run: `npx vitest run test/ssh-config.test.ts` → PASS.

- [ ] **Step 6b: "For the record" note helper (tests first)**

Create `test/notes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { composeNotes, AGENT_NOTE_MAX } from '../src/shared/notes'

describe('composeNotes', () => {
  it('returns no args when there is nothing to say', () => {
    expect(composeNotes('', [])).toEqual([])
    expect(composeNotes('   \n ', [])).toEqual([])
  })
  it('joins the user note and extras into one flag', () => {
    expect(composeNotes(' always use pnpm ', ['sudo -A please'])).toEqual([
      '--append-system-prompt',
      'For the record, from the user (applies to every session):\nalways use pnpm\n\nsudo -A please'
    ])
    expect(composeNotes('', ['x'])).toEqual(['--append-system-prompt', 'x'])
  })
  it('caps the user note', () => {
    const out = composeNotes('a'.repeat(AGENT_NOTE_MAX + 50), [])[1]
    expect(out.length).toBeLessThan(AGENT_NOTE_MAX + 120)
  })
})
```

Run `npx vitest run test/notes.test.ts` → FAIL. Create `src/shared/notes.ts`:

```ts
export const AGENT_NOTE_MAX = 2000

/**
 * One --append-system-prompt flag from the user's "for the record" note plus
 * Claudron's own notes. Claude Code takes the flag once, so everything is merged.
 */
export function composeNotes(userNote: string, extras: string[]): string[] {
  const parts: string[] = []
  const note = userNote.trim().slice(0, AGENT_NOTE_MAX)
  if (note) parts.push(`For the record, from the user (applies to every session):\n${note}`)
  parts.push(...extras.filter(Boolean))
  return parts.length ? ['--append-system-prompt', parts.join('\n\n')] : []
}
```

Run again → PASS.

- [ ] **Step 7: Extend settings**

In `src/shared/settings.ts` add the import and fields (also `agentNote`, see below):

```ts
import type { SshHost } from './ssh'
```
```ts
export interface Project {
  id: string
  name: string
  path: string
  /** Set for SSH sessions. `path` is then only a display string like user@host:~/dev. */
  ssh?: { hostId: string }
}
```
In `Settings` add:
```ts
  sshHosts: SshHost[]
  /** Client-side ServerAliveInterval so idle connections are not dropped. */
  sshKeepalive: boolean
  sshKeepaliveInterval: number
  /** "For the record" note appended to the system prompt of every Claude session, local and SSH. */
  agentNote: string
```
In `DEFAULT_SETTINGS` add:
```ts
  sshHosts: [],
  sshKeepalive: true,
  sshKeepaliveInterval: 30,
  agentNote: ''
```

- [ ] **Step 8: Verify and commit**

Run: `npm run typecheck && npm test`
Expected: both pass.

```bash
git add src/shared test docs/superpowers
git commit -m "feat(ssh): pure ssh core, config parser and settings fields"
```

---

### Task 2: Spawn an SSH session in the pty

**Files:**
- Create: `src/main/ssh.ts`, `src/main/ssh-session.ts`, `test/ssh-main.test.ts`
- Modify: `src/shared/pty.ts`, `src/shared/ipc.ts`, `src/main/pty.ts`, `src/main/index.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `findInPath(names, pathEnv, exists?)`, `findSsh()`, `readConfigHosts(sshDir?)` (`src/main/ssh.ts`); `prepareSsh(opts): Promise<Launch>` and type `Launch` (`src/main/ssh-session.ts`); `PtySpawnOptions.ssh?: { hostId: string }`; invoke channel `'ssh:config-hosts'` returning `string[]`.

- [ ] **Step 1: Write failing tests**

Create `test/ssh-main.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findInPath, readConfigHosts } from '../src/main/ssh'

describe('findInPath', () => {
  it('returns the first existing candidate and null when none', () => {
    const exists = (p: string): boolean => p.endsWith(join('two', 'ssh'))
    expect(findInPath(['ssh'], ['one', 'two'].join(process.platform === 'win32' ? ';' : ':'), exists)).toBe(join('two', 'ssh'))
    expect(findInPath(['ssh'], '', () => false)).toBeNull()
  })
})

describe('readConfigHosts', () => {
  it('reads config plus Include globs, and copes with a missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'claudron-ssh-'))
    expect(readConfigHosts(dir)).toEqual([])
    mkdirSync(join(dir, 'conf.d'))
    writeFileSync(join(dir, 'config'), 'Include conf.d/*.conf\nHost main\nInclude config\n')
    writeFileSync(join(dir, 'conf.d', 'a.conf'), 'Host extra\n')
    expect(readConfigHosts(dir).sort()).toEqual(['extra', 'main'])
  })
})
```

- [ ] **Step 2: Run to verify it fails** (`npx vitest run test/ssh-main.test.ts`, module missing).

- [ ] **Step 3: Implement `src/main/ssh.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**: `npx vitest run test/ssh-main.test.ts` → PASS.

- [ ] **Step 5: Add `ssh` to `PtySpawnOptions`**

In `src/shared/pty.ts`, inside `PtySpawnOptions` add:
```ts
  /** Run claude on a saved SSH host instead of locally. */
  ssh?: { hostId: string }
```

- [ ] **Step 6: Add the IPC channel** in `src/shared/ipc.ts`

In `InvokeMap` add `'ssh:config-hosts': { args: []; result: string[] }` and in `INVOKE_CHANNELS` add `'ssh:config-hosts': true`.

- [ ] **Step 7: Implement `src/main/ssh-session.ts`**

```ts
import { homedir } from 'node:os'
import { permissionFlags, type PtySpawnOptions } from '@shared/pty'
import {
  buildRemoteCommand,
  buildRemoteScript,
  buildSshArgs,
  isValidTarget,
  splitTarget
} from '@shared/ssh'
import { composeNotes } from '@shared/notes'
import { getSettings } from './settings-store'
import { findSsh } from './ssh'

export type Launch =
  | {
      ok: true
      file: string
      args: string[]
      cwd: string
      env: Record<string, string>
      binary: string
      /** Called when the pty exits or is killed. */
      cleanup?: () => void
    }
  | { ok: false; error: string }

export async function prepareSsh(opts: PtySpawnOptions): Promise<Launch> {
  const settings = getSettings()
  const host = settings.sshHosts.find((h) => h.id === opts.ssh?.hostId)
  if (!host) return { ok: false, error: 'That SSH host is no longer saved. Open it again from the SSH menu.' }
  if (!isValidTarget(host.target)) return { ok: false, error: `"${host.target}" is not a valid SSH host.` }
  const ssh = findSsh()
  if (!ssh) {
    return {
      ok: false,
      error:
        'Could not find the ssh command. Install OpenSSH (Windows: Settings > Optional features > OpenSSH Client) and restart Claudron.'
    }
  }

  const { host: target, port } = splitTarget(host.target)
  const claudeArgs = [
    ...(opts.continueSession ? ['--continue'] : []),
    ...permissionFlags(opts.permissionMode),
    ...composeNotes(settings.agentNote, [])
  ]
  const script = buildRemoteScript({ folder: host.folder, claudeArgs, sessionId: opts.id })
  const args = buildSshArgs({
    host: target,
    port,
    keepalive: settings.sshKeepalive,
    interval: settings.sshKeepaliveInterval,
    remoteCommand: buildRemoteCommand(script)
  })
  return { ok: true, file: ssh, args, cwd: homedir(), env: {}, binary: ssh }
}
```

- [ ] **Step 8: Refactor `src/main/pty.ts` to launch local or ssh**

Add imports: `import { homedir } from 'node:os'` is not needed; add `import { prepareSsh, type Launch } from './ssh-session'`. Add `cleanup?: () => void` to the `Session` interface. Replace the body of `spawnPty` from `await loadShellEnv()` through the end with:

```ts
  await loadShellEnv()
  const launch = opts.ssh ? await prepareSsh(opts) : prepareLocal(opts)
  if (!launch.ok) return launch

  let proc: pty.IPty
  try {
    proc = pty.spawn(launch.file, launch.args, {
      name: 'xterm-256color',
      cols: Math.max(opts.cols, 2),
      rows: Math.max(opts.rows, 2),
      cwd: launch.cwd,
      env: childEnv({ ...launch.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'claudron' }),
      useConpty: true
    })
  } catch (err) {
    launch.cleanup?.()
    return { ok: false, error: `Failed to start ${opts.ssh ? 'ssh' : 'claude'}: ${(err as Error).message}` }
  }

  const session: Session = { proc, buffer: '', flushQueued: false, cleanup: launch.cleanup }
  sessions.set(opts.id, session)

  // Batch bursts of output into one IPC message per tick.
  proc.onData((data) => {
    session.buffer += data
    if (!session.flushQueued) {
      session.flushQueued = true
      setTimeout(() => flush(opts.id), 4)
    }
  })

  proc.onExit(({ exitCode }) => {
    flush(opts.id)
    session.cleanup?.()
    if (sessions.get(opts.id)?.proc === proc) sessions.delete(opts.id)
    if (!session.killed) broadcast('pty:exit', { id: opts.id, exitCode })
  })

  return { ok: true, pid: proc.pid, binary: launch.binary, reused: false }
}

function prepareLocal(opts: PtySpawnOptions): Launch {
  const claude = findClaude()
  if (!claude) {
    return {
      ok: false,
      error: 'Could not find the claude binary. Install Claude Code (https://claude.com/claude-code) and restart Claudron.'
    }
  }
  const extras = argProviders.map((p) => p(opts))
  const args = [
    ...(opts.continueSession ? ['--continue'] : []),
    ...permissionFlags(opts.permissionMode),
    ...composeNotes(getSettings().agentNote, []),
    ...extras.flatMap((e) => e.args)
  ]
  const env = Object.assign({}, ...extras.map((e) => e.env ?? {})) as Record<string, string>
  const target = spawnTarget(claude.path, args)
  return { ok: true, file: target.file, args: target.args, cwd: opts.cwd, env, binary: claude.path }
}
```

`killPty` already deletes the session before `proc.kill()`; `onExit` still runs `session.cleanup`, so no change is needed there.

- [ ] **Step 9: Register the channel** in `src/main/index.ts`

Add `import { readConfigHosts } from './ssh'` and inside `registerIpc()`:
```ts
  handle('ssh:config-hosts', () => readConfigHosts())
```

- [ ] **Step 10: Verify**

Run: `npm run typecheck && npm test`
Expected: pass.

Manual: with a reachable host, add this temporary line to the dev console after launching `npm run dev`: save a host with `window.claudron.invoke('settings:set', { sshHosts: [{ id: 'box', target: '<your alias>', label: 'box', folder: '' }], projects: [{ id: 'ssh-box', name: 'box', path: 'box', ssh: { hostId: 'box' } }], activeProjectId: 'ssh-box', mode: 'cli' })`. The renderer does not yet send `ssh` (Task 3), so confirm only that the app still launches and local sessions still work. Full SSH check happens in Task 3.

- [ ] **Step 11: Commit**

```bash
git add src test
git commit -m "feat(ssh): launch claude over ssh from the pty layer"
```

---

### Task 3: SSH tabs and forced CLI mode (renderer plumbing)

**Files:**
- Modify: `src/renderer/src/lib/terminals.ts`, `src/renderer/src/components/CliView.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/components/TitleBar.tsx`, `src/renderer/src/styles/titlebar.css`

**Interfaces:**
- Consumes: `Project.ssh`, `PtySpawnOptions.ssh`.
- Produces: `TermEntry.sshHostId?: string`, `TermEntry.exitCode?: number`, `ensureTerminal(id, cwd, theme, sshHostId?)`, `reconnectTerminal(id, permissionMode, fresh?)`.

- [ ] **Step 1: Carry the host id through terminals**

In `src/renderer/src/lib/terminals.ts`:

1. `TermEntry` add `sshHostId?: string` and `exitCode?: number`.
2. `ensureTerminal(id, cwd, theme, sshHostId?: string)`; set `sshHostId` in the entry literal: `e = { id, cwd, term, fit, element, status: 'idle', lastOutputAt: 0, opened: false, sshHostId }`.
3. In the `pty:exit` handler set `e.exitCode = exitCode` and change the message by host kind:
```ts
    e.status = 'exited'
    e.exitCode = exitCode
    const what = e.sshHostId ? 'connection closed' : 'claude exited'
    const again = e.sshHostId ? 'reconnect' : 'start a new session'
    e.term.write(`\r\n\x1b[2m[${what} (code ${exitCode}). Press Enter to ${again}.]\x1b[0m\r\n`)
```
4. In `startClaude`, add to the `pty:spawn` payload: `ssh: entry.sshHostId ? { hostId: entry.sshHostId } : undefined`.
5. Add the export:
```ts
/** Bring an SSH terminal back after a drop. `fresh` skips --continue. */
export async function reconnectTerminal(id: string, permissionMode: ClaudronPermissionMode, fresh = false): Promise<void> {
  const e = entries.get(id)
  if (!e) return
  currentPermissionMode = permissionMode
  e.exitCode = undefined
  await startClaude(e, permissionMode, !fresh)
}
```
Also make the Enter-to-restart path in `term.onData` use `--continue` for ssh entries: `void startClaude(entry, currentPermissionMode, !!entry.sshHostId)`.

- [ ] **Step 2: Wire `CliView`**

In `CliView.tsx`: skip the git branch lookup for ssh, pass the host id, show the banner location, mark the root:
```tsx
  const isSsh = !!project.ssh
  useEffect(() => {
    if (isSsh) return
    void window.claudron.invoke('projects:branch', project.path).then(setBranch)
  }, [project.path, isSsh])
```
```tsx
    const entry = ensureTerminal(project.id, project.path, theme, project.ssh?.hostId)
```
```tsx
    <div className={`cli ${isSsh ? 'ssh' : ''}`}>
      ...
      <PumpkinBanner where={isSsh ? project.path : [shortPath(project.path), branch].filter(Boolean).join(' · ')} dismissed={typed} />
```

- [ ] **Step 3: Force CLI in `App.tsx`**

Replace the mode ternary:
```tsx
  const effectiveMode = project?.ssh ? 'cli' : settings.mode
  ...
        ) : effectiveMode === 'cli' ? (
```

- [ ] **Step 4: Disable the UI toggle for SSH in `TitleBar.tsx`**

```tsx
  const activeProject = settings.projects.find((p) => p.id === settings.activeProjectId)
  const sshActive = !!activeProject?.ssh
  const isUi = settings.mode === 'ui' && !sshActive
```
```tsx
        <button aria-pressed={isUi} disabled={sshActive} title={sshActive ? 'SSH sessions run in CLI mode' : undefined} onClick={() => update({ mode: 'ui' })}>
```
Append to `titlebar.css`:
```css
.segmented button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Then `npm run dev`, run the dev-console line from Task 2 Step 10 (it now works end to end). Expected: a tab "box" appears, the UI toggle is disabled, the terminal connects and `claude` starts on the remote (needs `claude` on the remote login shell PATH). Local project tabs still behave as before. Quit the app.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(ssh): ssh tabs run in CLI mode with a disabled UI toggle"
```

---

### Task 4: Host picker, tab badge, connection-lost overlay, Halloween styling

**Files:**
- Create: `src/renderer/src/components/HostPicker.tsx`, `SshBadge.tsx`, `SshLost.tsx`, `src/renderer/src/styles/ssh.css`
- Modify: `components/icons.tsx`, `components/TitleBar.tsx`, `components/CliView.tsx`, `App.tsx`, `main.tsx`

**Interfaces:**
- Consumes: Task 1 helpers, Task 3 `reconnectTerminal`, `useHaunt()` (`{ copy, spooky, full, still }`).
- Produces: `<HostPicker onClose />`, `<SshDot id />`, `<HostChip />`, `<SshLost project />`, `RemoteIcon`, `GhostIcon`.

- [ ] **Step 1: Icons** - append to `icons.tsx`:

```tsx
export function RemoteIcon(props: P): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 5h16v10H4zM9 19h6M12 15v4" />
      <path d="M9 9l2 1.5L9 12M13 12h2.5" />
    </svg>
  )
}

export function GhostIcon(props: P): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 20V10a7 7 0 0114 0v10l-2.4-2-2.3 2-2.3-2-2.3 2-2.3-2z" />
      <circle cx="9.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  )
}
```

- [ ] **Step 2: Styles** - create `styles/ssh.css` and import it in `main.tsx` after `'./styles/rail.css'`:

```css
:root[data-theme='dark'] {
  --ssh-pumpkin: #ff8a3d;
  --ssh-witch: #b79cff;
  --ssh-slime: #9ae66e;
  --ssh-bone: #f3ead2;
  --ssh-blood: #ff5370;
}
:root[data-theme='light'] {
  --ssh-pumpkin: #b44700;
  --ssh-witch: #5a2fc2;
  --ssh-slime: #2f7d1e;
  --ssh-bone: #2a1d3d;
  --ssh-blood: #b3203a;
}

.host-chip {
  position: relative;
  font: 600 9.5px var(--mono-font);
  letter-spacing: 0.1em;
  padding: 1px 6px;
  border-radius: 6px;
  color: var(--ssh-pumpkin);
  background: color-mix(in srgb, var(--ssh-pumpkin) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--ssh-pumpkin) 40%, transparent);
}
.host-chip.hallow::after {
  content: '';
  position: absolute;
  right: -1px;
  top: -1px;
  border-style: solid;
  border-width: 0 7px 7px 0;
  border-color: transparent var(--ssh-witch) transparent transparent;
  border-top-right-radius: 6px;
}

.ssh-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
  flex: none;
}
.ssh-dot.on {
  background: var(--ssh-slime);
}
.ssh-dot.lost {
  background: var(--ssh-blood);
}
.ssh-dot.on.ka {
  animation: ssh-ka var(--ka, 30s) ease-out infinite;
}
.ssh-dot.on.flicker {
  animation: ssh-flicker 1.2s steps(1) 1;
}
@keyframes ssh-ka {
  0%,
  96%,
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
  97% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--ssh-pumpkin) 45%, transparent);
  }
}
@keyframes ssh-flicker {
  0%, 30%, 60% { opacity: 1; }
  15%, 45% { opacity: 0.25; }
}
@media (prefers-reduced-motion: reduce) {
  .ssh-dot.on.ka,
  .ssh-dot.on.flicker {
    animation: none;
  }
}

.cli.ssh .cli-term {
  box-shadow: inset 0 2px 0 color-mix(in srgb, var(--ssh-witch) 55%, transparent);
}

.host-pop {
  position: absolute;
  top: 44px;
  left: 190px;
  z-index: 30;
  width: 300px;
  padding: 10px;
  border-radius: 12px;
  background: var(--panel);
  border: 1px solid var(--line-strong);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.host-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.host-row:hover {
  background: color-mix(in srgb, var(--ssh-witch) 14%, transparent);
}
.host-row .host-name {
  color: var(--ssh-witch);
  font-weight: 600;
}
.host-row .host-sub {
  color: var(--muted);
  font-size: 11px;
}
.host-row svg {
  color: var(--ssh-witch);
}

.ssh-lost {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  backdrop-filter: blur(2px);
}
.ssh-lost-card {
  max-width: 360px;
  padding: 18px 20px;
  border-radius: 14px;
  background: var(--panel);
  border: 1px solid color-mix(in srgb, var(--ssh-blood) 55%, transparent);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ssh-lost-card h3 {
  margin: 0;
  letter-spacing: 0.08em;
  color: var(--ssh-blood);
}
.ssh-lost-card p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.ssh-lost-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 4px;
}
.ssh-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--line-strong);
  background: transparent;
  cursor: pointer;
}
.ssh-btn.primary {
  background: var(--ssh-pumpkin);
  border-color: var(--ssh-pumpkin);
  color: var(--accent-ink, #1a0c02);
  font-weight: 600;
}
```

- [ ] **Step 3: `SshBadge.tsx`**

```tsx
import { useSyncExternalStore } from 'react'
import { getTerminal, subscribeTerminals } from '../lib/terminals'
import { useHaunt } from '../lib/haunt'
import { useSetting } from '../store/settings'
import { isHalloween, isWitchingHour } from '@shared/eggs'

export function HostChip(): React.JSX.Element {
  const { spooky } = useHaunt()
  return <span className={`host-chip ${spooky && isHalloween(new Date()) ? 'hallow' : ''}`}>SSH</span>
}

export function SshDot({ id }: { id: string }): React.JSX.Element {
  const status = useSyncExternalStore(subscribeTerminals, () => getTerminal(id)?.status ?? 'idle')
  const keepalive = useSetting('sshKeepalive')
  const interval = useSetting('sshKeepaliveInterval')
  const { spooky, still } = useHaunt()
  const state = status === 'running' ? 'on' : status === 'exited' || status === 'error' ? 'lost' : 'wait'
  const flicker = spooky && !still && state === 'on' && isWitchingHour(new Date())
  const label = state === 'on' ? 'Connected' : state === 'lost' ? 'Connection lost' : 'Connecting'
  return (
    <span
      className={`ssh-dot ${state} ${keepalive && !still ? 'ka' : ''} ${flicker ? 'flicker' : ''}`}
      style={{ ['--ka' as string]: `${interval}s` }}
      title={label}
      role="img"
      aria-label={label}
    />
  )
}
```
This imports `@shared/eggs`, created in Task 8. To keep this task independently runnable, create `src/shared/eggs.ts` now with just these two (Task 8 extends it):
```ts
export const isHalloween = (d: Date): boolean => d.getMonth() === 9 && d.getDate() === 31
export const isWitchingHour = (d: Date): boolean => d.getHours() === 0
```

- [ ] **Step 4: `SshLost.tsx`**

```tsx
import { useSyncExternalStore } from 'react'
import type { Project } from '@shared/settings'
import { getTerminal, reconnectTerminal, subscribeTerminals } from '../lib/terminals'
import { useSettings } from '../store/settings'

export function SshLost({ project }: { project: Project }): React.JSX.Element | null {
  const status = useSyncExternalStore(subscribeTerminals, () => getTerminal(project.id)?.status ?? 'idle')
  const mode = useSettings((s) => s.settings.permissionMode)
  const code = getTerminal(project.id)?.exitCode
  if (status !== 'exited' && status !== 'error') return null
  const unreachable = code === 255
  return (
    <div className="ssh-lost" role="alertdialog" aria-label="Connection lost">
      <div className="ssh-lost-card">
        <h3>CONNECTION LOST</h3>
        <p>
          {unreachable
            ? 'ssh could not connect or the link dropped. Check the host, your network and your keys.'
            : `The session on ${project.name} ended${code === undefined ? '' : ` (code ${code})`}.`}
        </p>
        <div className="ssh-lost-actions">
          <button className="ssh-btn primary" onClick={() => void reconnectTerminal(project.id, mode)}>
            Reconnect
          </button>
          <button className="ssh-btn" onClick={() => void reconnectTerminal(project.id, mode, true)} title="Skip --continue, start a new conversation">
            Start fresh
          </button>
        </div>
      </div>
    </div>
  )
}
```
Render `{isSsh && <SshLost project={project} />}` inside `.cli` in `CliView.tsx` after `<StatusLine/>`.

- [ ] **Step 5: `HostPicker.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Project } from '@shared/settings'
import { hostIdFor, hostLabel, isValidTarget, sshDisplay, type SshHost } from '@shared/ssh'
import { useSettings } from '../store/settings'
import { GhostIcon } from './icons'

export function HostPicker({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const [configHosts, setConfigHosts] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [folder, setFolder] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.claudron.invoke('ssh:config-hosts').then(setConfigHosts)
    const onDown = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return
      if ((e.target as HTMLElement).closest?.('[aria-label="Open SSH session"]')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const saved = settings.sshHosts
  const fromConfig: SshHost[] = configHosts
    .filter((h) => !saved.some((s) => s.target === h))
    .map((h) => ({ id: hostIdFor(h), target: h, label: h, folder: '' }))

  const open = (host: SshHost): void => {
    const hosts = saved.some((h) => h.id === host.id) ? saved : [...saved, host]
    const pid = `ssh-${host.id}`
    const known = settings.projects.some((p) => p.id === pid)
    const project: Project = { id: pid, name: host.label, path: sshDisplay(host), ssh: { hostId: host.id } }
    update({
      sshHosts: hosts,
      projects: known ? settings.projects : [...settings.projects, project],
      activeProjectId: pid
    })
    onClose()
  }

  const valid = isValidTarget(target.trim())
  const add = (): void => {
    if (!valid) return
    const t = target.trim()
    open({ id: hostIdFor(t), target: t, label: hostLabel(t), folder: folder.trim() })
  }

  const row = (h: SshHost): React.JSX.Element => (
    <button key={h.id} className="host-row" onClick={() => open(h)}>
      <GhostIcon />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="host-name">{h.label}</span>
        <span className="host-sub mono">{sshDisplay(h)}</span>
      </span>
    </button>
  )

  return (
    <div className="host-pop" ref={ref} role="dialog" aria-label="SSH hosts">
      <span className="pop-heading">OVER THE WIRE</span>
      {saved.map(row)}
      {fromConfig.map(row)}
      {saved.length + fromConfig.length === 0 && <span className="pop-hint">No hosts yet. Haunt one below.</span>}
      <span className="pop-heading" style={{ marginTop: 8 }}>HAUNT A NEW HOST</span>
      <input className="pop-input" spellCheck={false} placeholder="user@host or ssh alias" value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
      <input className="pop-input" spellCheck={false} placeholder="start folder (optional, e.g. ~/dev)" value={folder} onChange={(e) => setFolder(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
      {target && !valid && <span className="pop-hint">Letters, numbers, dots and dashes only. Add :port or user@ if needed.</span>}
      <button className="ssh-btn primary" disabled={!valid} onClick={add}>Connect</button>
    </div>
  )
}
```

- [ ] **Step 6: Wire `TitleBar` and `App`**

`TitleBar` props add `onOpenHosts: () => void`; import `RemoteIcon`, `HostChip`, `SshDot`. After the existing `+` button inside `.tabs`:
```tsx
        <button className="icon-btn" aria-label="Open SSH session" title="Open over SSH" onClick={onOpenHosts}>
          <RemoteIcon />
        </button>
```
Inside each tab, replace `{active && <span className="dot" />}` with:
```tsx
              {p.ssh ? <SshDot id={p.id} /> : active && <span className="dot" />}
              {p.ssh && <HostChip />}
```
`App.tsx`: add `const [hostsOpen, setHostsOpen] = useState(false)`, pass `onOpenHosts={() => setHostsOpen((o) => !o)}` and render `{hostsOpen && <HostPicker onClose={() => setHostsOpen(false)} />}` beside the settings popover. The `.host-pop` is `position: absolute`; make sure `.app` is `position: relative` (check `base.css`; add `position: relative` to `.app` if missing).

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm test`. Then `npm run dev` and check, in both themes: the SSH button opens the picker; config hosts listed; picking one opens a tab with a green dot and `SSH` chip, in CLI mode; killing the connection (disable network or `ssh` process end) shows the overlay; Reconnect and Start fresh work; with OS reduced motion on, the dot does not pulse. Quit.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat(ssh): host picker, status dot, connection-lost overlay, halloween styling"
```

---

### Task 5: Encrypted secret store and Settings UI

**Files:**
- Create: `src/main/secrets.ts`, `src/renderer/src/components/SecretsSettings.tsx`
- Modify: `src/shared/ipc.ts`, `src/main/index.ts`, `src/renderer/src/components/SettingsPopover.tsx`

**Interfaces:**
- Consumes: `SecretMeta`, `pickSecret`, `validateSecretInput`.
- Produces: `listSecrets(): Promise<SecretMeta[]>`, `addSecret(name, value, scope)`, `removeSecret(id)`, `secretValue(name, hostId): Promise<string | null>` (`src/main/secrets.ts`); invoke channels `'secrets:list'`, `'secrets:add'`, `'secrets:remove'`.

- [ ] **Step 1: IPC types** - in `src/shared/ipc.ts` import `SecretMeta` from `./ssh` and add to `InvokeMap`:

```ts
  'secrets:list': { args: []; result: SecretMeta[] }
  'secrets:add': { args: [name: string, value: string, scope: string]; result: { ok: true; secrets: SecretMeta[] } | { ok: false; error: string } }
  'secrets:remove': { args: [id: string]; result: SecretMeta[] }
```
and to `INVOKE_CHANNELS` the same three keys set to `true`. Add to `EventMap`: `'ssh:secret-used': { id: string; name: string; at: number }` and `'ssh:secret-used': true` to `EVENT_CHANNELS` (used in Task 6).

- [ ] **Step 2: `src/main/secrets.ts`**

```ts
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { pickSecret, validateSecretInput, type SecretMeta } from '@shared/ssh'

interface Item extends SecretMeta {
  value: string
}

const file = (): string => join(app.getPath('userData'), 'secrets.bin')
let cache: Item[] | null = null

async function load(): Promise<Item[]> {
  if (cache) return cache
  cache = []
  if (safeStorage.isEncryptionAvailable() && existsSync(file())) {
    try {
      cache = JSON.parse(safeStorage.decryptString(await readFile(file()))) as Item[]
    } catch {
      cache = []
    }
  }
  return cache
}

async function save(items: Item[]): Promise<void> {
  cache = items
  await writeFile(file(), safeStorage.encryptString(JSON.stringify(items)))
}

const strip = ({ id, name, scope }: Item): SecretMeta => ({ id, name, scope })

export async function listSecrets(): Promise<SecretMeta[]> {
  return (await load()).map(strip)
}

export async function addSecret(
  name: string,
  value: string,
  scope: string
): Promise<{ ok: true; secrets: SecretMeta[] } | { ok: false; error: string }> {
  const bad = validateSecretInput(name, value)
  if (bad) return { ok: false, error: bad }
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'This computer has no secure storage available, so Claudron will not save secrets.' }
  }
  const items = (await load()).filter((i) => !(i.name.toLowerCase() === name.toLowerCase() && i.scope === scope))
  items.push({ id: randomUUID(), name, scope, value })
  await save(items)
  return { ok: true, secrets: items.map(strip) }
}

export async function removeSecret(id: string): Promise<SecretMeta[]> {
  const items = (await load()).filter((i) => i.id !== id)
  if (safeStorage.isEncryptionAvailable()) await save(items)
  return items.map(strip)
}

/** For main-process use only. Never exposed over IPC. */
export async function secretValue(name: string, hostId: string): Promise<string | null> {
  const hit = pickSecret(await load(), name, hostId)
  return hit ? hit.value : null
}
```

- [ ] **Step 3: Register** in `src/main/index.ts` (`import { addSecret, listSecrets, removeSecret } from './secrets'`):

```ts
  handle('secrets:list', () => listSecrets())
  handle('secrets:add', (name, value, scope) => addSecret(name, value, scope))
  handle('secrets:remove', (id) => removeSecret(id))
```

- [ ] **Step 4: `SecretsSettings.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { SecretMeta } from '@shared/ssh'
import { useSettings } from '../store/settings'

export function SecretsSettings(): React.JSX.Element {
  const hosts = useSettings((s) => s.settings.sshHosts)
  const [items, setItems] = useState<SecretMeta[]>([])
  const [value, setValue] = useState('')
  const [shown, setShown] = useState(false)
  const [scope, setScope] = useState('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.claudron.invoke('secrets:list').then(setItems)
  }, [])

  const scopeName = (s: string): string => (s === 'all' ? 'All hosts' : (hosts.find((h) => h.id === s)?.label ?? 'Removed host'))

  const save = async (): Promise<void> => {
    const res = await window.claudron.invoke('secrets:add', 'SUDO', value, scope)
    if (res.ok) {
      setItems(res.secrets)
      setValue('')
      setShown(false)
      setError(null)
    } else setError(res.error)
  }

  return (
    <>
      <span className="pop-hint">
        Sudo password Claude can use on your SSH hosts but never sees. Stored encrypted on this computer.
      </span>
      {items.map((s) => (
        <div key={s.id} className="secret-row">
          <span className="mono">sudo password</span>
          <span className="pop-hint">{scopeName(s.scope)}</span>
          <span className="mono muted">••••••••</span>
          <button className="link-btn" onClick={() => void window.claudron.invoke('secrets:remove', s.id).then(setItems)}>
            Delete
          </button>
        </div>
      ))}
      <div className="secret-form">
        <input
          className="pop-input"
          type={shown ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder="sudo password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && value && void save()}
        />
        <label className="pop-check">
          <input type="checkbox" checked={shown} onChange={() => setShown((x) => !x)} />
          Show
        </label>
        <select className="pop-input" aria-label="Use on" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">Use on: all hosts</option>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              Use on: {h.label}
            </option>
          ))}
        </select>
        <button className="ssh-btn primary" disabled={!value} onClick={() => void save()}>
          Save password
        </button>
        {error && <span className="pop-hint" style={{ color: 'var(--ssh-blood)' }}>{error}</span>}
      </div>
    </>
  )
}
```
Add to `ssh.css`:
```css
.secret-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 8px;
  align-items: center;
}
.secret-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
```

- [ ] **Step 5: Add to `SettingsPopover.tsx`**

Import `SecretsSettings` and add after the Spotify section:
```tsx
        <div className="pop-section">
          <span className="pop-heading">SECRETS</span>
          <SecretsSettings />
        </div>
```
Check `popover.css`: the popover must scroll when tall. If `.popover` has no `max-height`/`overflow-y`, add `max-height: calc(100vh - 64px); overflow-y: auto;`.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm test`. Then `npm run dev`: save a password for a host, confirm the row shows dots only, restart the app and confirm it persists, Delete removes it. Confirm `secrets.bin` in userData is not readable text (`Get-Content` shows binary). Confirm the renderer never receives the value (devtools: `await window.claudron.invoke('secrets:list')` returns no `value`). Quit.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(ssh): encrypted secret store and settings UI"
```

---

### Task 6: Askpass bridge (Claude uses sudo, never sees the password)

**Files:**
- Create: `src/main/ssh-bridge.ts`, `test/ssh-bridge.test.ts`, `src/renderer/src/components/SecretToast.tsx`
- Modify: `src/main/ssh-session.ts`, `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `secretValue`, `listSecrets`, `pickSecret`, `buildRemoteScript({ askpass })`, `buildSshArgs({ bridge })`, `SUDO_NOTE`, `broadcast('ssh:secret-used', ...)`.
- Produces: `openBridge(lookup, onUse, opts?): Promise<Bridge>` with `Bridge = { port: number; token: string; close(): void }`.

- [ ] **Step 1: Write failing tests** - `test/ssh-bridge.test.ts`:

```ts
import { connect } from 'node:net'
import { describe, expect, it } from 'vitest'
import { openBridge } from '../src/main/ssh-bridge'

function ask(port: number, payload: string | null, wait = 1500): Promise<string> {
  return new Promise((resolve) => {
    let out = ''
    const s = connect(port, '127.0.0.1', () => payload !== null && s.write(payload))
    s.on('data', (d) => (out += d.toString()))
    s.on('close', () => resolve(out))
    s.on('error', () => resolve(out))
    setTimeout(() => s.destroy(), wait)
  })
}

const weird = `p'w"$x\\y \`z\``

describe('askpass bridge', () => {
  it('returns the secret byte-exact for a good token and reports use', async () => {
    const used: string[] = []
    const b = await openBridge(async (n) => (n === 'SUDO' ? weird : null), (n) => used.push(n))
    expect(await ask(b.port, `${b.token}\tSUDO\n`)).toBe(`${weird}\n`)
    expect(used).toEqual(['SUDO'])
    b.close()
  })

  it('refuses a wrong token, an unknown name and does not report use', async () => {
    const used: string[] = []
    const b = await openBridge(async (n) => (n === 'SUDO' ? 'x' : null), (n) => used.push(n))
    expect(await ask(b.port, `nope\tSUDO\n`)).toBe('\n')
    expect(await ask(b.port, `${b.token}\tOTHER\n`)).toBe('\n')
    expect(used).toEqual([])
    b.close()
  })

  it('drops oversize and stalled requests without answering', async () => {
    const b = await openBridge(async () => 'x', () => {}, { timeoutMs: 150 })
    expect(await ask(b.port, 'a'.repeat(2000))).toBe('')
    expect(await ask(b.port, null)).toBe('')
    b.close()
  })

  it('stops listening after close', async () => {
    const b = await openBridge(async () => 'x', () => {})
    b.close()
    expect(await ask(b.port, `${b.token}\tSUDO\n`, 300)).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify it fails** (`npx vitest run test/ssh-bridge.test.ts`, module missing).

- [ ] **Step 3: Implement `src/main/ssh-bridge.ts`**

```ts
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type Socket } from 'node:net'

export interface Bridge {
  port: number
  token: string
  close(): void
}

export type SecretLookup = (name: string) => Promise<string | null>

const MAX_REQUEST = 256

/**
 * Loopback-only. The remote askpass helper sends one line "TOKEN<TAB>NAME\n" and
 * gets "VALUE\n" back, or an empty line when refused.
 */
export async function openBridge(
  lookup: SecretLookup,
  onUse: (name: string) => void,
  opts: { timeoutMs?: number } = {}
): Promise<Bridge> {
  const token = randomBytes(24).toString('hex')
  const tokenBuf = Buffer.from(token)
  const sockets = new Set<Socket>()

  const server = createServer((sock) => {
    sockets.add(sock)
    sock.on('close', () => sockets.delete(sock))
    sock.on('error', () => sock.destroy())
    sock.setTimeout(opts.timeoutMs ?? 3000, () => sock.destroy())
    let buf = ''
    sock.on('data', (d) => {
      buf += d.toString('utf8')
      if (buf.length > MAX_REQUEST) return sock.destroy()
      const nl = buf.indexOf('\n')
      if (nl === -1) return
      const [given = '', name = ''] = buf.slice(0, nl).split('\t')
      const givenBuf = Buffer.from(given)
      const ok = givenBuf.length === tokenBuf.length && timingSafeEqual(givenBuf, tokenBuf)
      if (!ok) return void sock.end('\n')
      void lookup(name).then(
        (value) => {
          if (value === null) return void sock.end('\n')
          onUse(name)
          sock.end(`${value}\n`)
        },
        () => sock.end('\n')
      )
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    port,
    token,
    close: () => {
      server.close()
      for (const s of sockets) s.destroy()
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**: `npx vitest run test/ssh-bridge.test.ts` → PASS.

- [ ] **Step 5: Wire into `prepareSsh`** (`src/main/ssh-session.ts`)

Add imports:
```ts
import { randomInt } from 'node:crypto'
import { SUDO_NOTE, pickSecret } from '@shared/ssh'
import { broadcast } from './ipc'
import { listSecrets, secretValue } from './secrets'
import { openBridge, type Bridge } from './ssh-bridge'
```
Before building `claudeArgs`, add:
```ts
  let bridge: Bridge | null = null
  let remotePort = 0
  if (pickSecret(await listSecrets(), 'SUDO', host.id)) {
    bridge = await openBridge(
      (name) => secretValue(name, host.id),
      (name) => broadcast('ssh:secret-used', { id: opts.id, name, at: Date.now() })
    )
    remotePort = randomInt(20000, 60000)
  }
```
Change `claudeArgs` to append the note when the bridge exists:
```ts
  const claudeArgs = [
    ...(opts.continueSession ? ['--continue'] : []),
    ...permissionFlags(opts.permissionMode),
    ...composeNotes(settings.agentNote, bridge ? [SUDO_NOTE] : [])
  ]
  const script = buildRemoteScript({
    folder: host.folder,
    claudeArgs,
    sessionId: opts.id,
    askpass: bridge ? { port: remotePort, token: bridge.token } : undefined
  })
```
Pass `bridge: bridge ? { remote: remotePort, local: bridge.port } : undefined` to `buildSshArgs`, and return `cleanup: () => bridge?.close()` in the launch result. Also close the bridge on the early-return error paths that occur after it opens (none do, since the bridge opens after validation).

- [ ] **Step 6: `SecretToast.tsx`** and mount it

```tsx
import { useEffect, useRef, useState } from 'react'
import { useHaunt } from '../lib/haunt'

export function SecretToast(): React.JSX.Element | null {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>(0)
  const { spooky } = useHaunt()
  useEffect(
    () =>
      window.claudron.on('ssh:secret-used', ({ name }) => {
        setMsg(`Claude used your saved ${name === 'SUDO' ? 'sudo password' : name}${spooky ? ' (it never saw it)' : ''}`)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setMsg(null), 2800)
      }),
    [spooky]
  )
  if (!msg) return null
  return (
    <div className="secret-toast" role="status">
      {msg}
    </div>
  )
}
```
Append to `ssh.css`:
```css
.secret-toast {
  position: fixed;
  right: 16px;
  bottom: 44px;
  z-index: 40;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  background: var(--panel);
  border: 1px solid color-mix(in srgb, var(--ssh-slime) 55%, transparent);
  color: var(--fg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
```
Render `<SecretToast />` in `App.tsx` next to `<SoundEffects />`.

- [ ] **Step 7: Verify the `-R` risk first, then the whole flow**

Run: `npm run typecheck && npm test`. Then, on a real host (needs `bash`, `sudo`, `AllowTcpForwarding` on): save a sudo password in Settings, open the host, ask Claude "run `sudo -A whoami`". Expected: runs as root with no prompt, a "Claude used your saved sudo password" toast appears, and the password is not in the terminal, in `~/.claudron/askpass-*` on the remote (`grep` it), or in `env | grep -i pass`. Repeat on both Windows and macOS clients. If `-R` fails on a host (forwarding disabled), the session must still open and `sudo -A` must just fail; confirm there is no crash. If `-R` fails on a platform entirely, stop and report before continuing.

- [ ] **Step 8: Commit**

```bash
git add src test
git commit -m "feat(ssh): askpass bridge so claude can sudo without seeing the password"
```

---

### Task 7: Remote settings (hosts, folder, keepalive)

**Files:**
- Create: `src/renderer/src/components/RemoteSettings.tsx`
- Modify: `src/renderer/src/components/SettingsPopover.tsx`

**Interfaces:**
- Consumes: `Settings.sshHosts`, `sshKeepalive`, `sshKeepaliveInterval`, `sshDisplay`, `disposeTerminal`.

- [ ] **Step 1: Implement `RemoteSettings.tsx`**

```tsx
import { sshDisplay, type SshHost } from '@shared/ssh'
import { useSettings } from '../store/settings'
import { disposeTerminal } from '../lib/terminals'

export function RemoteSettings(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const { sshHosts: hosts, sshKeepalive, sshKeepaliveInterval } = settings

  const setFolder = (h: SshHost, folder: string): void => {
    if (folder === h.folder) return
    const next = { ...h, folder }
    update({
      sshHosts: hosts.map((x) => (x.id === h.id ? next : x)),
      projects: settings.projects.map((p) => (p.ssh?.hostId === h.id ? { ...p, path: sshDisplay(next) } : p))
    })
  }

  const remove = (h: SshHost): void => {
    const pid = `ssh-${h.id}`
    const projects = settings.projects.filter((p) => p.ssh?.hostId !== h.id)
    disposeTerminal(pid)
    update({
      sshHosts: hosts.filter((x) => x.id !== h.id),
      projects,
      activeProjectId: settings.activeProjectId === pid ? (projects[projects.length - 1]?.id ?? null) : settings.activeProjectId
    })
  }

  return (
    <>
      <label className="pop-check">
        <input type="checkbox" checked={sshKeepalive} onChange={() => update({ sshKeepalive: !sshKeepalive })} />
        Keep SSH connections alive
      </label>
      <span className="pop-hint">
        Sends a ping from this computer so idle links are not dropped. It cannot stop a server that ends idle sessions on purpose.
      </span>
      {sshKeepalive && (
        <label className="pop-field">
          <span className="pop-hint">Seconds between pings (5 to 300)</span>
          <input
            className="pop-input"
            type="number"
            min={5}
            max={300}
            defaultValue={sshKeepaliveInterval}
            onBlur={(e) => {
              const n = Math.min(300, Math.max(5, Math.round(Number(e.target.value) || 30)))
              e.target.value = String(n)
              if (n !== sshKeepaliveInterval) update({ sshKeepaliveInterval: n })
            }}
          />
        </label>
      )}
      {hosts.map((h) => (
        <div key={h.id} className="secret-row">
          <span className="mono">{h.label}</span>
          <input
            className="pop-input"
            spellCheck={false}
            placeholder="start folder"
            aria-label={`Start folder for ${h.label}`}
            defaultValue={h.folder}
            onBlur={(e) => setFolder(h, e.target.value.trim())}
          />
          <span />
          <button className="link-btn" onClick={() => remove(h)}>
            Remove
          </button>
        </div>
      ))}
      {hosts.length === 0 && <span className="pop-hint">Saved hosts show up here after you open one.</span>}
    </>
  )
}
```
Changing the keepalive settings applies to the next connection; add `<span className="pop-hint">Applies to new connections.</span>` under the interval input.

- [ ] **Step 2: Mount** in `SettingsPopover.tsx` before `SECRETS`:
```tsx
        <div className="pop-section">
          <span className="pop-heading">REMOTE</span>
          <RemoteSettings />
        </div>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`. `npm run dev`: edit a folder, reconnect and confirm the remote starts there (`pwd` through Claude or the status line); remove a host and confirm its tab closes; toggle keepalive off and confirm a new connection has no `ServerAliveInterval` (check with `Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Select CommandLine`). Quit.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat(ssh): remote settings for hosts, start folder and keepalive"
```

---

### Task 8: "For the record" note in Settings

**Files:**
- Create: `src/renderer/src/components/AgentNoteSettings.tsx`
- Modify: `src/renderer/src/components/SettingsPopover.tsx`, `src/main/pty.ts` (already wired in Tasks 1-2 via `composeNotes`), `src/renderer/src/styles/ssh.css`

**Interfaces:**
- Consumes: `Settings.agentNote`, `AGENT_NOTE_MAX`, `restartAllTerminals(permissionMode)`.

The note goes to every new Claude session, local and SSH, as part of `--append-system-prompt`. It applies when a session starts; running sessions keep the old note until restarted.

- [ ] **Step 1: Implement `AgentNoteSettings.tsx`**

```tsx
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
```
Append to `ssh.css`:
```css
.agent-note {
  resize: vertical;
  min-height: 72px;
  font: inherit;
  line-height: 1.4;
}
.note-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.note-actions .pop-hint {
  margin-right: auto;
}
```

- [ ] **Step 2: Mount** in `SettingsPopover.tsx` as the first of the new sections (above REMOTE):
```tsx
        <div className="pop-section">
          <span className="pop-heading">FOR THE RECORD</span>
          <AgentNoteSettings />
        </div>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test`. `npm run dev`: save "Always end replies with the word PUMPKIN", click Apply now, send a message in a local tab and confirm Claude follows it; open an SSH tab and confirm the same. Clear the note and confirm no `--append-system-prompt` remains (check the `claude` or `ssh` process command line). Quit.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat(settings): for-the-record note sent to every claude session"
```

---

### Task 9: Easter eggs

**Files:**
- Modify: `src/shared/eggs.ts`, `src/renderer/src/components/SshLost.tsx`, `SecretToast.tsx`, `CliView.tsx`, `HostPicker.tsx`, `icons.tsx`, `styles/ssh.css`
- Test: `test/eggs.test.ts`

**Interfaces:**
- Produces in `src/shared/eggs.ts`: `isFriday13(d)`, `isHalloween(d)`, `isWitchingHour(d)`, `hostEgg(label)`, `SUDO_UNLUCKY`.

- [ ] **Step 1: Failing tests** - `test/eggs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hostEgg, isFriday13, isHalloween, isWitchingHour } from '../src/shared/eggs'

describe('eggs', () => {
  it('finds Friday the 13th, Halloween and the witching hour', () => {
    expect(isFriday13(new Date(2026, 10, 13))).toBe(true) // Fri 13 Nov 2026
    expect(isFriday13(new Date(2026, 10, 12))).toBe(false)
    expect(isFriday13(new Date(2026, 9, 13))).toBe(false) // a Tuesday
    expect(isHalloween(new Date(2026, 9, 31))).toBe(true)
    expect(isHalloween(new Date(2026, 9, 30))).toBe(false)
    expect(isWitchingHour(new Date(2026, 9, 5, 0, 30))).toBe(true)
    expect(isWitchingHour(new Date(2026, 9, 5, 1, 0))).toBe(false)
  })
  it('matches haunted host names case-insensitively', () => {
    expect(hostEgg('Crystal-Lake')).toBe('mask')
    expect(hostEgg('haddonfield')).toBe('pumpkin')
    expect(hostEgg('derry')).toBe('balloon')
    expect(hostEgg('devbox')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails** (`hostEgg`/`isFriday13` missing), then extend `src/shared/eggs.ts`:

```ts
export const isFriday13 = (d: Date): boolean => d.getDay() === 5 && d.getDate() === 13
export const isHalloween = (d: Date): boolean => d.getMonth() === 9 && d.getDate() === 31
export const isWitchingHour = (d: Date): boolean => d.getHours() === 0

export type HostEgg = 'mask' | 'pumpkin' | 'balloon' | null
export function hostEgg(label: string): HostEgg {
  switch (label.toLowerCase()) {
    case 'crystal-lake':
      return 'mask'
    case 'haddonfield':
      return 'pumpkin'
    case 'derry':
      return 'balloon'
    default:
      return null
  }
}

/** Sudo uses in one session before the toast gets cheeky. */
export const SUDO_UNLUCKY = 13
```
Run `npx vitest run test/eggs.test.ts` → PASS.

- [ ] **Step 3: Wire the visuals (all gated by `spooky`, motion by `!still`)**

- `icons.tsx`: add `HockeyMaskIcon` (an oval face outline with three holes and two slits):
```tsx
export function HockeyMaskIcon(props: P): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" {...props}>
      <path d="M12 3c-4 0-7 3-7 8 0 5 3 10 7 10s7-5 7-10c0-5-3-8-7-8z" />
      <path d="M8 9.5l2.5 1M16 9.5l-2.5 1" strokeLinecap="round" />
      <circle cx="12" cy="14" r="0.8" fill="currentColor" />
      <circle cx="10" cy="16.5" r="0.7" fill="currentColor" />
      <circle cx="14" cy="16.5" r="0.7" fill="currentColor" />
    </svg>
  )
}
```
- `HostPicker.tsx` `row()`: pick the icon by `hostEgg(h.label)`: `mask` → `HockeyMaskIcon`, `pumpkin` → `<LogoMark size={16} />`, `balloon` → a red circle `<span style={{ width: 11, height: 14, borderRadius: '50%', background: 'var(--ssh-blood)' }} />`, else `GhostIcon`. Only when `spooky` (`useHaunt()`), else always `GhostIcon`.
- `CliView.tsx`: `const f13 = spooky && isFriday13(new Date())`; add `f13 ? 'f13' : ''` to the `.cli` class list and render `{f13 && isSsh && <HockeyMaskIcon className="f13-mask" aria-hidden />}`.
- `SshLost.tsx`: when `spooky && isFriday13(new Date())` use heading text `ki ki ki ma ma ma` and the primary button label `Run to the cabin` (aria-labels unchanged).
- `SecretToast.tsx`: keep a `useRef<Record<string, number>>` count per project id; on the `SUDO_UNLUCKY`th use (and only then) show `Unlucky for some.` instead of the normal message.
- `ssh.css`:
```css
.cli.f13 .f13-mask {
  position: absolute;
  right: 28px;
  bottom: 54px;
  width: 120px;
  height: 120px;
  color: var(--ssh-bone);
  opacity: 0.05;
  pointer-events: none;
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test`. Manual: temporarily override the clock by changing `new Date()` to `new Date(2026, 10, 13)` in `CliView.tsx` and `SshLost.tsx` (and `2026, 9, 31` in `SshBadge.tsx`) to eyeball each egg in both themes, then revert those edits. Confirm nothing shows at haunt level `Subtle`, and that nothing animates with reduced motion on.

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "feat(ssh): friday the 13th, halloween and haunted host easter eggs"
```

---

### Task 10: Final verification and docs

**Files:**
- Modify: `README.md`, `docs/DESIGN_SPEC.md` (short section), `docs/superpowers/specs/2026-10-05-ssh-sessions-design.md` (record the deviations)

- [ ] **Step 1:** Update the spec with the "Deviations" list from the top of this plan, no em dashes.
- [ ] **Step 2:** Add a short "SSH sessions" section to `README.md`: requirements (system OpenSSH, `claude` on the remote, `bash` and `AllowTcpForwarding` for the sudo password feature), keepalive caveat, and the honest secrets limit (not a sandbox).
- [ ] **Step 3:** Run `npm run typecheck && npm test && npm run build`. Expected: all pass.
- [ ] **Step 4:** Full manual pass on Windows and macOS: both themes, all three haunt levels, reduced motion, connect, idle past a firewall timeout with keepalive on, forced drop and both reconnect buttons, `sudo -A`, local sessions unaffected, UI mode unaffected for non-SSH projects.
- [ ] **Step 5: Commit**

```bash
git add README.md docs
git commit -m "docs: ssh sessions, keepalive and secrets"
```
