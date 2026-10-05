let home = ''

export async function loadAppInfo(): Promise<void> {
  const info = await window.wraith.invoke('app:info')
  home = info.home
}

/** /Users/me/code/x -> ~/code/x */
export function tildify(path: string): string {
  if (home && (path === home || path.startsWith(home + '/') || path.startsWith(home + '\\'))) {
    return '~' + path.slice(home.length).replace(/\\/g, '/')
  }
  return path
}

/** Middle-truncates long paths: /very/long/.../project/dir */
export function shortPath(path: string, max = 48): string {
  const p = tildify(path)
  if (p.length <= max) return p
  const parts = p.split('/')
  const tail = parts.slice(-2).join('/')
  return `${parts[0] || '/'}${parts[0] ? '/' : ''}…/${tail}`
}

/** claude-opus-5-5[1m] -> opus */
export function shortModel(model: string | null | undefined): string {
  if (!model) return 'claude'
  const m = /(opus|sonnet|haiku|fable)/i.exec(model)
  return m ? m[1].toLowerCase() : model.replace(/^claude-/, '')
}
