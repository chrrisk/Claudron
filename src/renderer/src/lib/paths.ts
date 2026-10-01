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

/** claude-opus-5-5[1m] -> opus */
export function shortModel(model: string | null | undefined): string {
  if (!model) return 'claude'
  const m = /(opus|sonnet|haiku|fable)/i.exec(model)
  return m ? m[1].toLowerCase() : model.replace(/^claude-/, '')
}
