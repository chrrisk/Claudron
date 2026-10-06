export const isFriday13 = (d: Date): boolean => d.getDay() === 5 && d.getDate() === 13
export const isHalloween = (d: Date): boolean => d.getMonth() === 9 && d.getDate() === 31
export const isWitchingHour = (d: Date): boolean => d.getHours() === 0

export type HostEgg = 'mask' | 'pumpkin' | 'balloon' | null
export function hostEgg(label: string): HostEgg {
  switch (label.toLowerCase()) {
    case 'crystal-lake':
      return 'mask'
    case 'haddonfield':
      return 'pumpkin'
    case 'derry':
      return 'balloon'
    default:
      return null
  }
}

/** Sudo uses in one session before the toast gets cheeky. */
export const SUDO_UNLUCKY = 13
