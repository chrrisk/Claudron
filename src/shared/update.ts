export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'none' }
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string }
  /** Dev runs and platforms without a signed build: nothing to update in place. */
  | { kind: 'unsupported'; reason: string }
