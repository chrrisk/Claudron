import { randomInt } from 'node:crypto'
import { homedir } from 'node:os'
import { composeNotes } from '@shared/notes'
import { permissionFlags, type PtySpawnOptions } from '@shared/pty'
import {
  SUDO_NOTE,
  buildRemoteCommand,
  buildRemoteScript,
  buildSshArgs,
  isValidTarget,
  pickSecret,
  splitTarget
} from '@shared/ssh'
import { broadcast } from './ipc'
import { listSecrets, secretValue } from './secrets'
import { getSettings } from './settings-store'
import { findSsh } from './ssh'
import { openBridge, type Bridge } from './ssh-bridge'

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

  let bridge: Bridge | null = null
  let remotePort = 0
  if (pickSecret(await listSecrets(), 'SUDO', host.id)) {
    bridge = await openBridge(
      (name) => secretValue(name, host.id),
      (name) => broadcast('ssh:secret-used', { id: opts.id, name, at: Date.now() })
    )
    remotePort = randomInt(20000, 60000)
  }

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
  const args = buildSshArgs({
    host: target,
    port,
    keepalive: settings.sshKeepalive,
    interval: settings.sshKeepaliveInterval,
    bridge: bridge ? { remote: remotePort, local: bridge.port } : undefined,
    remoteCommand: buildRemoteCommand(script)
  })
  return { ok: true, file: ssh, args, cwd: homedir(), env: {}, binary: ssh, cleanup: () => bridge?.close() }
}
