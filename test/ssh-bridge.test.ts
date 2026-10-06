import { connect } from 'node:net'
import { describe, expect, it } from 'vitest'
import { openBridge } from '../src/main/ssh-bridge'

function ask(port: number, payload: string | null, wait = 1500): Promise<string> {
  return new Promise((resolve) => {
    let out = ''
    const s = connect(port, '127.0.0.1', () => payload !== null && s.write(payload))
    s.on('data', (d) => (out += d.toString()))
    s.on('close', () => resolve(out))
    s.on('error', () => resolve(out))
    setTimeout(() => s.destroy(), wait)
  })
}

const weird = `p'w"$x\\y \`z\``

describe('askpass bridge', () => {
  it('returns the secret byte-exact for a good token and reports use', async () => {
    const used: string[] = []
    const b = await openBridge(async (n) => (n === 'SUDO' ? weird : null), (n) => used.push(n))
    expect(await ask(b.port, `${b.token}\tSUDO\n`)).toBe(`${weird}\n`)
    expect(used).toEqual(['SUDO'])
    b.close()
  })

  it('refuses a wrong token, an unknown name and does not report use', async () => {
    const used: string[] = []
    const b = await openBridge(async (n) => (n === 'SUDO' ? 'x' : null), (n) => used.push(n))
    expect(await ask(b.port, `nope\tSUDO\n`)).toBe('\n')
    expect(await ask(b.port, `${b.token}\tOTHER\n`)).toBe('\n')
    expect(used).toEqual([])
    b.close()
  })

  it('drops oversize and stalled requests without answering', async () => {
    const b = await openBridge(async () => 'x', () => {}, { timeoutMs: 150 })
    expect(await ask(b.port, 'a'.repeat(2000))).toBe('')
    expect(await ask(b.port, null)).toBe('')
    b.close()
  })

  it('stops listening after close', async () => {
    const b = await openBridge(async () => 'x', () => {})
    b.close()
    expect(await ask(b.port, `${b.token}\tSUDO\n`, 300)).toBe('')
  })
})
