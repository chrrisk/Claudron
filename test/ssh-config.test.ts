import { describe, expect, it } from 'vitest'
import { parseSshConfig } from '../src/shared/ssh-config'

describe('parseSshConfig', () => {
  it('lists concrete host aliases', () => {
    const text = `
# comment
Host devbox
  HostName 10.0.0.5
Host build prod # trailing comment
  User ci
host = quoted "weird"
Host *
  ServerAliveInterval 10
Host !bad foo?
Hostname not-a-host
`
    expect(parseSshConfig(text)).toEqual(['devbox', 'build', 'prod', 'quoted', 'weird'])
  })

  it('follows Include with a reader and survives include loops', () => {
    const files: Record<string, string> = {
      'a.conf': 'Host from-a\nInclude loop.conf',
      'loop.conf': 'Host from-loop\nInclude loop.conf'
    }
    const read = (p: string): string[] => (files[p] ? [files[p]] : [])
    expect(parseSshConfig('Include a.conf\nHost top', read).sort()).toEqual(['from-a', 'from-loop', 'top'])
  })

  it('returns nothing for empty text', () => {
    expect(parseSshConfig('')).toEqual([])
  })
})
