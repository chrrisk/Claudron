import { execFile } from 'node:child_process'
import { userInfo } from 'node:os'

/**
 * Apps launched from Finder or the Dock on macOS get a bare PATH
 * (/usr/bin:/bin:...), so `claude` installed via npm, Homebrew or the native
 * installer is invisible. Ask the user's login shell for its PATH once and
 * merge it in. Windows GUI apps already inherit the full PATH.
 */
let loaded: Promise<void> | null = null

export function loadShellEnv(): Promise<void> {
  if (process.platform === 'win32') return Promise.resolve()
  loaded ??= new Promise((resolve) => {
    const shell = process.env['SHELL'] || userInfo().shell || '/bin/zsh'
    const marker = '__WRAITH_PATH__'
    execFile(
      shell,
      ['-ilc', `printf '${marker}%s${marker}' "$PATH"`],
      { timeout: 5000, env: { ...process.env, DISABLE_AUTO_UPDATE: 'true' } },
      (err, stdout) => {
        if (!err) {
          const m = new RegExp(`${marker}(.*)${marker}`).exec(stdout)
          if (m && m[1]) {
            const merged = new Set([...m[1].split(':'), ...(process.env['PATH'] ?? '').split(':')])
            process.env['PATH'] = [...merged].filter(Boolean).join(':')
          }
        }
        resolve()
      }
    )
  })
  return loaded
}
