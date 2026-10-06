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
  const opts = { folder: "~/my dir/it's $(x)", claudeArgs: ['--permission-mode', 'default'], sessionId: 'ssh-box' }
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
    const s = buildRemoteScript({ ...opts, askpass: { port: 41000, token: 'abc123', sudo: 'pw' } })
    expect(s).toContain('export SUDO_ASKPASS=')
    expect(s).toContain('with-secret')
    expect(buildRemoteScript({ ...opts, askpass: { port: 1, token: 't' } })).not.toContain('SUDO_ASKPASS')
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
  it.each(['plain', "it's", 'a "b" $HOME `x` \\n', 'spaces and\ttabs', '$(touch /tmp/x)', ''])('%j', (s) => {
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
