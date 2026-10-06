import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { app, safeStorage, shell } from 'electron'
import { SPOTIFY_REDIRECT_PORT, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES } from '@shared/spotify'

export interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const tokenFile = (): string => join(app.getPath('userData'), 'spotify.bin')

const b64url = (buf: Buffer): string => buf.toString('base64url')

// ---------------------------------------------------------------------------
// Storage: tokens are encrypted with the OS keychain (safeStorage). If that is
// unavailable they only live in memory for this run.

export async function loadTokens(): Promise<Tokens | null> {
  if (!safeStorage.isEncryptionAvailable() || !existsSync(tokenFile())) return null
  try {
    const raw = safeStorage.decryptString(await readFile(tokenFile()))
    return JSON.parse(raw) as Tokens
  } catch {
    return null
  }
}

export async function saveTokens(t: Tokens): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) return
  await writeFile(tokenFile(), safeStorage.encryptString(JSON.stringify(t)))
}

export async function clearTokens(): Promise<void> {
  await rm(tokenFile(), { force: true })
}

// ---------------------------------------------------------------------------
// Authorization Code + PKCE with a loopback redirect.

let pending: { server: Server; reject: (e: Error) => void } | null = null

function page(title: string, body: string): string {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0a11;color:#ede7f6;font:16px system-ui">
<div style="text-align:center"><div style="font-size:40px">🎃</div><h1 style="font-size:20px;letter-spacing:.1em">${title}</h1><p style="color:#9c91b0">${body}</p></div>`
}

export function cancelLogin(): void {
  if (!pending) return
  pending.server.close()
  pending.reject(new Error('Login cancelled'))
  pending = null
}

export async function login(clientId: string): Promise<Tokens> {
  cancelLogin()
  const verifier = b64url(randomBytes(64))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', SPOTIFY_REDIRECT_URI)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const err = url.searchParams.get('error')
      const got = url.searchParams.get('code')
      const ok = !err && got && url.searchParams.get('state') === state
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(ok ? page('Spotify connected', 'You can close this tab and go back to Claudron.') : page('Spotify login failed', err ?? 'State mismatch'))
      server.close()
      pending = null
      if (ok) resolve(got)
      else reject(new Error(err ?? 'Spotify login failed'))
    })
    server.on('error', (e) => {
      pending = null
      reject(new Error(`Could not listen on ${SPOTIFY_REDIRECT_URI}: ${e.message}`))
    })
    server.listen(SPOTIFY_REDIRECT_PORT, '127.0.0.1')
    pending = { server, reject }
    // Give up after five minutes.
    setTimeout(() => {
      if (pending?.server === server) cancelLogin()
    }, 5 * 60 * 1000).unref()

    const auth = new URL('https://accounts.spotify.com/authorize')
    auth.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope: SPOTIFY_SCOPES,
      state
    }).toString()
    void shell.openExternal(auth.toString())
  })

  return exchange(clientId, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_verifier: verifier
  })
}

export async function refresh(clientId: string, refreshToken: string): Promise<Tokens> {
  return exchange(clientId, { grant_type: 'refresh_token', refresh_token: refreshToken }, refreshToken)
}

async function exchange(clientId: string, params: Record<string, string>, prevRefresh?: string): Promise<Tokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...params })
  })
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`)
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  const tokens: Tokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? prevRefresh ?? '',
    expiresAt: Date.now() + (json.expires_in - 60) * 1000
  }
  await saveTokens(tokens)
  return tokens
}
