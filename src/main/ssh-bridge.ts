import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type Socket } from 'node:net'

export interface Bridge {
  port: number
  token: string
  close(): void
}

export type SecretLookup = (name: string) => Promise<string | null>

const MAX_REQUEST = 256

/**
 * Loopback-only. The remote askpass helper sends one line "TOKEN<TAB>NAME\n" and
 * gets "VALUE\n" back, or an empty line when refused.
 */
export async function openBridge(
  lookup: SecretLookup,
  onUse: (name: string) => void,
  opts: { timeoutMs?: number } = {}
): Promise<Bridge> {
  const token = randomBytes(24).toString('hex')
  const tokenBuf = Buffer.from(token)
  const sockets = new Set<Socket>()

  const server = createServer((sock) => {
    sockets.add(sock)
    sock.on('close', () => sockets.delete(sock))
    sock.on('error', () => sock.destroy())
    sock.setTimeout(opts.timeoutMs ?? 3000, () => sock.destroy())
    let buf = ''
    sock.on('data', (d) => {
      buf += d.toString('utf8')
      if (buf.length > MAX_REQUEST) return sock.destroy()
      const nl = buf.indexOf('\n')
      if (nl === -1) return
      const [given = '', name = ''] = buf.slice(0, nl).split('\t')
      const givenBuf = Buffer.from(given)
      const ok = givenBuf.length === tokenBuf.length && timingSafeEqual(givenBuf, tokenBuf)
      if (!ok) return void sock.end('\n')
      void lookup(name).then(
        (value) => {
          if (value === null) return void sock.end('\n')
          onUse(name)
          sock.end(`${value}\n`)
        },
        () => sock.end('\n')
      )
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    port,
    token,
    close: () => {
      server.close()
      for (const s of sockets) s.destroy()
    }
  }
}
