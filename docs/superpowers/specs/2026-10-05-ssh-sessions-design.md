# SSH sessions, keepalive and secrets

Status: approved by user 2026-10-05, palette and secrets UX revised. Date: 2026-10-05.

## Goal

Pick an SSH host, get a Claude Code session running there, inside Claudron. Store secrets (e.g. a sudo password) that Claude can use but never sees. Keep idle connections alive from the client side.

## Decisions (from brainstorming)

- SSH sessions are **CLI mode only**. Opening one forces CLI view. The UI/CLI toggle is disabled for that session with a tooltip. Theme, haunt level, sounds, Spotify and all other settings are shared and unchanged. No per-session sync or UI overrides.
- UI mode over SSH is out of scope. It needs the Agent SDK to spawn over ssh and remote session history; revisit after verifying the SDK exposes a spawn hook.
- Auth uses the system `ssh` binary, so `~/.ssh/config`, keys, agent and known_hosts all work. Claudron never types or stores SSH passwords or key passphrases.
- `claude` must already be installed on the remote.
- Secrets use the **askpass bridge**. Not a hard sandbox; the UI says so.

## 1. SSH sessions

**Host source:** parse `~/.ssh/config` `Host` entries (skip wildcard and `Match` blocks, follow `Include`). Users can also add a manual host (alias or `user@host[:port]`). Each saved host can have a start folder and a keepalive override.

**Spawn:** `pty.ts` builds `ssh -tt <opts> <host> -- cd <folder> && claude <args>` instead of the local binary. Permission-mode flags reuse `permissionFlags` from `shared/pty.ts`. The local usage-tap `--settings` arg is not added for SSH sessions (it points at a local file), so the cauldron shows NO READING for SSH sessions unless a real value arrives. It never estimates.

**Drop handling:** on unexpected exit, the terminal stays visible with an overlay: "Connection lost" and a Reconnect button. Reconnect respawns with the same host and folder. Deliberate close sends no notice, same as the existing `killed` flag.

**New files:** `src/main/ssh.ts` (host parsing, command building), `src/shared/ssh.ts` (types), preload bridge methods `ssh.listHosts`, `ssh.saveHost`, `ssh.removeHost`.

## 2. Keepalive

Client side only. Add `-o ServerAliveInterval=30 -o ServerAliveCountMax=4` and `-o TCPKeepAlive=yes`. On by default, interval overridable per host, with an off switch. This prevents idle drops from NAT and firewalls and detects dead links in about 2 minutes. It cannot beat a server that force-kills sessions (`ClientAliveCountMax`, idle `TMOUT`); the settings help text says so. ControlMaster is out of scope (poor Windows support).

## 3. Secrets

**Storage:** list of `{ id, name, scope }` in settings; values live only in Electron `safeStorage`-encrypted storage in the main process. Values are write-only: the renderer can set, rename, delete and see a masked dot string, never read back. `scope` is `all` or a host id.

**Askpass bridge:**
1. On SSH spawn, Claudron starts a loopback listener in main (random port, per-session token) and adds `-R <remote-port>:127.0.0.1:<local-port>`. TCP loopback is used, not a unix socket, because Windows OpenSSH support for forwarded unix sockets is unreliable.
2. Claudron writes a small helper to `~/.claudron/askpass` on the remote (mode 700, contains the port and token, no secret) and sets `SUDO_ASKPASS` to it for the session.
3. When Claude runs `sudo -A`, the helper connects back, sends the token and the secret name, and main answers if the secret's scope allows that host.
4. Each answer logs a quiet line in the session ("sudo used secret `SUDO`") and a subtle toast. Token is revoked when the session ends.

Claude needs to know to use `sudo -A`. Claudron appends a one-line note via `--append-system-prompt` naming available secret names (never values).

**Limits, shown in settings:** the secret stays out of the transcript, remote disk and env. A deliberately adversarial Claude could still run the helper directly. Also not handled: secrets as arbitrary env vars (would leak via `echo`). Revisit if requested.

**Open question to verify first:** `-R` TCP forwarding with system OpenSSH on Windows 11 and macOS. If a host disallows `AllowTcpForwarding`, sessions still work but secrets are unavailable, with a clear notice.

## 4. Visual design

Same Claudron language (Chakra Petch, existing dark/light tokens), plus a **Halloween palette** for SSH surfaces so remote reads as its own spooky place:

| Token | Dark | Light | Use |
|---|---|---|---|
| `sshPumpkin` | `#ff8a3d` | `#b44700` | host chip, keepalive pulse |
| `sshWitch` | `#b79cff` | `#5a2fc2` | host name, selection |
| `sshSlime` | `#9ae66e` | `#2f7d1e` | connected dot |
| `sshBone` | `#f3ead2` | `#2a1d3d` | chip text |
| `sshBlood` | `#ff5370` | `#b3203a` | connection lost |

Pumpkin, witch purple and blood reuse existing theme tokens (`accent`, `violet`, `danger`); only slime and bone are new. `docs/mockups/*.dc.html` stays the source of truth; contrast-check text use.

- **Summon menu:** "Summon session" becomes a split choice: "Here" and "Over the wire". The second opens a host picker: small ghost glyph, host name, `user@host` muted, last-used time. A "Haunt a new host" row adds one.
- **Sidebar rows:** SSH sessions show a pumpkin host chip and a slime/pumpkin/blood status dot (connected, keepalive tick, lost). No layout change otherwise.
- **Keepalive:** a soft pumpkin pulse on the dot at each interval. Pulse is skipped under `prefers-reduced-motion` (dot only, no animation).
- **Settings:** a "Remote" section with hosts and a keepalive toggle (interval tucked under "Advanced"). A "Secrets" section built for non-experts:
  - Plain-English line at top: "Secrets Claude can use but never see. Stored encrypted on this computer."
  - One button, "Add secret". Quick starts: "Sudo password" (prefills name `SUDO`), or "Other". Fields: Name, Value (hidden, with show toggle while typing), "Use on": All hosts (default) or one host.
  - After save, value is never shown again. Rows show name, dots, "Use on", and Delete. Edit means re-enter the value.
  - Sudo password needs no explanation: Claudron tells Claude to use `sudo -A` itself. The user never touches askpass, ports or tokens.
  - Inline form, no modal.
- **Copy:** no em dashes. Plain where it matters (errors, secret limits), playful only in headings and empty states.

### Easter eggs

All gated by the haunt level (off at `subtle`) and `prefers-reduced-motion` for any motion.

- **Friday the 13th:** on that date, SSH connection chrome gets a faint hockey-mask watermark and the lost-connection overlay reads "ki ki ki ma ma ma". Reconnect becomes "Run to the cabin".
- **Halloween (Oct 31):** host chips get a tiny candy-corn corner; the first successful connect of the day drops one pixel pumpkin in the sidebar.
- **Midnight (00:00 to 00:59):** connected dot flickers once like a candle on connect.
- **Host named `crystal-lake`, `haddonfield` or `derry`:** its ghost glyph swaps for a themed one. Pure name match, no network.
- **Sudo used 13 times in one session:** toast "Unlucky for some."

## 5. Testing

Unit tests (vitest, existing setup):
- `~/.ssh/config` parsing: wildcards skipped, `Include` followed, comments, case-insensitive keys.
- Command builder: quoting of host and folder, keepalive flags, per-host override and off switch, no local `--settings` for SSH.
- Secret scoping and token validation in the bridge (wrong token, wrong host, revoked).
- Date-gated easter eggs via an injected clock.

Manual: real SSH host or local WSL sshd. Verify connect, `sudo -A` through the bridge, forced disconnect and Reconnect, reduced-motion, both themes, Windows and macOS.

## Build order

1. Host parsing and SSH spawn (no keepalive, no secrets). Verify a session starts.
2. Keepalive flags, drop overlay and Reconnect.
3. Sidebar and summon menu UI, forced CLI mode.
4. Secrets storage and settings UI.
5. Askpass bridge (verify `-R` first).
6. Easter eggs.

Each step finished and verified (app launches, feature works) before the next, per `CLAUDE.md`.

## Deviations (decided while planning)

- Secrets UI is sudo-password only (fixed name `SUDO`, choose "Use on"). The data model stays generic, but arbitrary env-style secrets would leak via `echo`, so no UI for them.
- No Summon-menu split. The sidebar only exists in UI mode and SSH is CLI-only. Entry point is an "Open SSH session" button in the title bar.
- Keepalive is global (toggle plus interval), no per-host override.
- Added after the spec: a "For the record" note in Settings (`agentNote`), appended to every Claude session's system prompt, local and SSH, as a single `--append-system-prompt` flag merged with the sudo note.
- Halloween "pumpkin drop in sidebar" egg dropped (no sidebar in CLI mode). The candy-corn chip stays.
- The askpass helper needs `bash` on the remote (uses `/dev/tcp`). The remote login shell must be POSIX-like or fish 3.4+.
