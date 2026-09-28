# Wraith: design spec

A Windows/Mac desktop wrapper for Claude Code. Futuristic + Halloween. Two interface styles (pretty UI and raw CLI), dark/light, a haunt level, Spotify mini player, and a usage cauldron.

The mockups in `docs/mockups/` are the visual source of truth. They are HTML files with inline styles, so exact colors, sizes, spacing and copy can be read straight from them. `Main.dc.html` holds everything (the other boards just load it with different starting props). Its `<script>` block at the bottom has the theme tokens and all the copy logic. Ignore the `<x-dc>`, `<sc-if>`, `<sc-for>`, `{{hole}}` syntax: it is the mockup tool's templating, not something to port. Translate it to React.

## Hard rules

1. **No em dashes anywhere** in UI copy, docs, commit messages or comments. Use `-`, `·`, or rewrite the sentence.
2. Dark mode is the default theme. UI mode is the default interface style.
3. Respect `prefers-reduced-motion`: every animation turns off.
4. Never ship a client secret. Spotify uses PKCE.

## Architecture

| Piece | Choice |
| --- | --- |
| Shell | Electron + electron-vite + React + TypeScript |
| Packaging | electron-builder, targets: Windows (nsis) and macOS (dmg, universal) |
| CLI mode | `node-pty` spawns the real `claude` binary, rendered with `xterm.js` (+ fit and webgl addons) |
| UI mode | `@anthropic-ai/claude-agent-sdk` (structured messages, tool calls, permission requests) |
| State | Zustand, settings persisted with `electron-store` |
| Spotify | Spotify Web API, Authorization Code + PKCE, loopback redirect `http://127.0.0.1:<port>/callback` |

Why two engines: CLI mode is a real terminal, so it later generalises to "any command" (the RUNNER list in the sidebar). UI mode needs structured events to draw message cards, diffs and the permission card, which terminal text can't give reliably.

Keep the main process thin: pty management, Agent SDK session, Spotify token storage (use `safeStorage`), usage file reading. Everything else lives in the renderer, talking over a typed IPC bridge in `preload`.

## Layout (1280 x 800 reference window, should be resizable)

- **Title bar, 48px:** logo (hexagon jack-o'-lantern) + `WRAITH`, project tabs, then right side: Spotify pill (if presence = pill), `UI | >_ CLI` segmented toggle, theme button (full moon in dark, sunrise in light), settings gear.
- **UI mode:** sidebar 232px (sessions, runner list, Summon session button) | conversation (context strip, messages, composer) | right rail 300px (Spotify card, usage cauldron).
- **CLI mode:** full-width terminal + 32px status line at the bottom. No sidebar or rail.
- **Settings popover:** anchored under the gear, 320px wide.

## Theme tokens

Copy the `tokens()` function from `Main.dc.html` into a `themes.ts`. Expose them as CSS variables on `:root[data-theme]`.

Fonts: UI = Chakra Petch (Google Fonts, bundle it locally), mono = JetBrains Mono, optional UI font = Excalifont (`assets/fonts/Excalifont-Regular.woff2`). Code, diffs and the terminal are always JetBrains Mono.

## Settings

| Setting | Options | Default |
| --- | --- | --- |
| Theme | dark, light | dark |
| Interface | ui, cli | ui |
| Haunt level | subtle, spooky, full | spooky |
| Font | Chakra Petch, Excalifont | Chakra Petch |
| Sound effects | creaky door on permission prompt, bell on task finish | off in subtle, on otherwise |
| Spotify presence | off, pill, card | card |
| Permission mode | ask, accept edits, plan, unleashed (`--dangerously-skip-permissions` / `bypassPermissions`) | ask, remembers the user's last choice |

When permission mode is **unleashed**, show a red `UNLEASHED` badge in the UI context strip and the CLI status line, and show a one-time warning the first time it is turned on.

## Haunt level

| Feature | Subtle | Spooky | Full |
| --- | --- | --- | --- |
| Spooky copy (table below) | | ✓ | ✓ |
| Fog drifting behind the composer / terminal | | ✓ | ✓ |
| Candle flicker on glows (permission card, play button, cursor) | | ✓ | ✓ |
| Moon-phase spinner `◐ ◓ ◑ ◒` + rotating verbs | | ✓ | ✓ |
| Old sessions as tombstones | | ✓ | ✓ |
| Cobweb in the conversation corner that grows with idle time and shrinks on typing | static | ✓ | ✓ |
| ASCII pumpkin banner at CLI session start (scrolls away like normal output) | | ✓ | ✓ |
| "Summon a spooky playlist" button | | ✓ | ✓ |
| Bats around the "task finished" toast (UI) | | | ✓ |
| Bats fly across the top of the terminal every so often (CLI, random interval ~15-40s) | | | ✓ |
| Glitchy green error lines | | | ✓ |
| Sound effects on by default | | | ✓ |

Keyframes (`wraithFog`, `wraithFlicker`, `wraithBat`, `wraithFlyby`, `wraithFlap`, `wraithGlitch`, `wraithCursor`) are in the `<helmet><style>` of `Main.dc.html`. Reuse them.

## Copy

| Spot | Subtle | Spooky / Full |
| --- | --- | --- |
| New session button | New session | Summon session |
| Composer placeholder | Ask anything, or type / for commands | Speak, mortal. Or type / for commands |
| Permission tag | NEEDS YOU | AT THE DOOR |
| Permission lead | Claude wants to run | Claude is at the door and wants to run |
| Permission buttons | Allow once / Always allow / Deny | Invite in once / Always welcome / Banish |
| Working status | Working | Brewing / Consulting the spirits / Rattling bones / Reading the bones |
| Ended session | Fix flaky CI test · 1h ago | RIP · Fix flaky CI test · laid to rest 1h ago |
| Error prefix | Error: | Something went bump in the night: |

Permission buttons map to keys `1`, `2`, `3`.

## Usage cauldron

The only usage display. Liquid level = 5-hour session usage. Weekly usage is a violet bar under it. See `Usage.dc.html` for all four states.

| Mood | Range | Color | Bubbles |
| --- | --- | --- | --- |
| CALM | 0-39% | green | 1 |
| SIMMERING | 40-74% | orange | 3 |
| BOILING | 75-91% | orange | 5 |
| BOILING OVER | 92%+ | red, spills over the rim | 5 |

CLI status line version: `cauldron ██████░░░░ 62%`.

**Never estimate.** The cauldron only shows real plan-limit percentages and reset times reported by Claude Code or Anthropic. Do not compute percentages from token counts, local logs, guessed plan limits or user-entered limits. No interpolating between readings either: show the last real reading and its age ("as of 2m ago").

**Data source: verify before building.** Find where Claude Code exposes real session and weekly limit percentages (Agent SDK result or rate-limit messages, status line input, `/usage` output, response headers). Report what you find before building the cauldron.

**No reading state:** if no real value is available (not found, not yet received, or stale past 10 minutes), the cauldron is empty with a dashed outline, the mood reads `NO READING`, the percent shows `--%`, and the CLI segment shows `cauldron --`. Never show a guessed number in its place.

## Spotify

States in `Spotify.dc.html`: not connected, playing, ducked (volume drops to 30% while a permission prompt waits, restores after), compact pill, CLI status-line segment.

- Scopes: `user-read-playback-state user-modify-playback-state user-read-currently-playing`.
- Poll currently-playing every ~3s while the window is focused, slower when blurred.
- Play/pause/skip/volume need Premium. Detect a 403 and show "Playback controls need Spotify Premium" instead of failing silently.
- Spooky playlist button: search playlists for "halloween" or let the user pin one in settings.
- Hotkey in CLI mode: `ctrl+space` toggles play/pause.

## Build order

1. Electron + React shell, title bar, theme tokens, dark/light toggle, settings store.
2. CLI mode: node-pty + xterm.js running `claude` in the selected project folder, status line.
3. UI mode: Agent SDK session, message list, Read/Edit tool cards with diffs, permission card wired to SDK permission callbacks, composer.
4. Settings popover with every setting above, persisted.
5. Haunt level system + animations + sounds.
6. Usage cauldron (after the data source is confirmed).
7. Spotify.
8. Packaging for Windows and macOS via GitHub Actions.
