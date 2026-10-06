import { describe, expect, it } from 'vitest'
import { hostEgg, isFriday13, isHalloween, isWitchingHour } from '../src/shared/eggs'

describe('eggs', () => {
  it('finds Friday the 13th, Halloween and the witching hour', () => {
    expect(isFriday13(new Date(2026, 10, 13))).toBe(true) // Fri 13 Nov 2026
    expect(isFriday13(new Date(2026, 10, 12))).toBe(false)
    expect(isFriday13(new Date(2026, 9, 13))).toBe(false) // a Tuesday
    expect(isHalloween(new Date(2026, 9, 31))).toBe(true)
    expect(isHalloween(new Date(2026, 9, 30))).toBe(false)
    expect(isWitchingHour(new Date(2026, 9, 5, 0, 30))).toBe(true)
    expect(isWitchingHour(new Date(2026, 9, 5, 1, 0))).toBe(false)
  })
  it('matches haunted host names case-insensitively', () => {
    expect(hostEgg('Crystal-Lake')).toBe('mask')
    expect(hostEgg('haddonfield')).toBe('pumpkin')
    expect(hostEgg('derry')).toBe('balloon')
    expect(hostEgg('Tanglewood')).toBe('emf')
    expect(hostEgg('devbox')).toBeNull()
  })
})
