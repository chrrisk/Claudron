import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findInPath, readConfigHosts } from '../src/main/ssh'

describe('findInPath', () => {
  it('returns the first existing candidate and null when none', () => {
    const exists = (p: string): boolean => p.endsWith(join('two', 'ssh'))
    expect(findInPath(['ssh'], ['one', 'two'].join(delimiter), exists)).toBe(join('two', 'ssh'))
    expect(findInPath(['ssh'], '', () => false)).toBeNull()
  })
})

describe('readConfigHosts', () => {
  it('reads config plus Include globs, and copes with a missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'claudron-ssh-'))
    expect(readConfigHosts(dir)).toEqual([])
    mkdirSync(join(dir, 'conf.d'))
    writeFileSync(join(dir, 'config'), 'Include conf.d/*.conf\nHost main\nInclude config\n')
    writeFileSync(join(dir, 'conf.d', 'a.conf'), 'Host extra\n')
    expect(readConfigHosts(dir).sort()).toEqual(['extra', 'main'])
  })
})
