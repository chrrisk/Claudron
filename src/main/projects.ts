import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import type { Project } from '@shared/settings'

export async function pickProject(): Promise<Project | null> {
  const win = BrowserWindow.getFocusedWindow()
  const opts = { title: 'Open a project folder', properties: ['openDirectory', 'createDirectory'] as const }
  const res = win ? await dialog.showOpenDialog(win, { ...opts, properties: [...opts.properties] })
    : await dialog.showOpenDialog({ ...opts, properties: [...opts.properties] })
  if (res.canceled || res.filePaths.length === 0) return null
  const path = res.filePaths[0]
  return { id: randomUUID(), name: basename(path) || path, path }
}

/** Find the .git dir for a path, walking up. Handles worktrees where .git is a file. */
async function findGitDir(start: string): Promise<string | null> {
  let dir = resolve(start)
  for (;;) {
    const candidate = join(dir, '.git')
    try {
      const s = await stat(candidate)
      if (s.isDirectory()) return candidate
      const text = await readFile(candidate, 'utf8')
      const m = /^gitdir:\s*(.+)$/m.exec(text)
      if (m) return resolve(dir, m[1].trim())
    } catch {
      // keep walking
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Current branch name, short sha when detached, or null outside a repo. No git binary needed. */
export async function gitBranch(path: string): Promise<string | null> {
  const gitDir = await findGitDir(path)
  if (!gitDir) return null
  try {
    const head = (await readFile(join(gitDir, 'HEAD'), 'utf8')).trim()
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head)
    return ref ? ref[1] : head.slice(0, 7)
  } catch {
    return null
  }
}
