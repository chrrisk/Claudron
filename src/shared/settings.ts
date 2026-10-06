import type { SshHost } from './ssh'

export type Theme = 'dark' | 'light'
export type InterfaceMode = 'ui' | 'cli'
export type HauntLevel = 'subtle' | 'spooky' | 'full'
export type UiFont = 'chakra' | 'excali'
export type SpotifyPresence = 'off' | 'pill' | 'card'
/** Claudron's names for Claude Code permission modes. `unleashed` skips every prompt. */
export type ClaudronPermissionMode = 'ask' | 'acceptEdits' | 'plan' | 'unleashed'

export interface Project {
  id: string
  name: string
  path: string
  /** Set for SSH sessions. `path` is then only a display string like user@host:~/dev. */
  ssh?: { hostId: string }
}

export interface Settings {
  theme: Theme
  mode: InterfaceMode
  haunt: HauntLevel
  font: UiFont
  /** null means "follow the haunt level default" */
  doorSound: boolean | null
  bellSound: boolean | null
  spotify: SpotifyPresence
  permissionMode: ClaudronPermissionMode
  /** set once the user has seen the unleashed warning */
  unleashedWarned: boolean
  projects: Project[]
  activeProjectId: string | null
  /** Spotify app client id (PKCE, no secret). Empty uses the build-time default, if any. */
  spotifyClientId: string
  /** Playlist URI or link for the spooky button. Empty means search for one. */
  spookyPlaylist: string
  sshHosts: SshHost[]
  /** Client-side ServerAliveInterval so idle connections are not dropped. */
  sshKeepalive: boolean
  sshKeepaliveInterval: number
  /** "For the record" note appended to the system prompt of every Claude session, local and SSH. */
  agentNote: string
  /** Name of the saved secret sudo should use on SSH hosts. Empty means none. */
  sudoSecret: string
  /** Claude Code model alias for new sessions. Empty means Claude Code's own default. */
  model: string
  /** Show the cauldron and Spotify card beside the terminal in CLI mode. */
  cliRail: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  mode: 'ui',
  haunt: 'spooky',
  font: 'chakra',
  doorSound: null,
  bellSound: null,
  spotify: 'card',
  permissionMode: 'ask',
  unleashedWarned: false,
  projects: [],
  activeProjectId: null,
  spotifyClientId: '',
  spookyPlaylist: '',
  sshHosts: [],
  sshKeepalive: true,
  sshKeepaliveInterval: 30,
  agentNote: '',
  sudoSecret: '',
  model: '',
  cliRail: false
}
