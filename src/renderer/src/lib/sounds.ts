/**
 * Both effects are synthesized with Web Audio, so there are no sound files to
 * ship or license. Kept short and quiet on purpose.
 */
let ctx: AudioContext | null = null

function audio(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** A slow, wobbling sawtooth through a resonant band-pass: a door hinge. */
export function playCreak(): void {
  const ac = audio()
  const now = ac.currentTime
  const dur = 1.1

  const osc = ac.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(70, now)
  osc.frequency.linearRampToValueAtTime(110, now + 0.35)
  osc.frequency.linearRampToValueAtTime(85, now + 0.7)
  osc.frequency.linearRampToValueAtTime(130, now + dur)

  // Irregular stick-slip: a fast LFO on the pitch.
  const lfo = ac.createOscillator()
  lfo.type = 'square'
  lfo.frequency.setValueAtTime(23, now)
  lfo.frequency.linearRampToValueAtTime(31, now + dur)
  const lfoGain = ac.createGain()
  lfoGain.gain.value = 18
  lfo.connect(lfoGain).connect(osc.frequency)

  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.setValueAtTime(900, now)
  band.frequency.linearRampToValueAtTime(1400, now + dur)
  band.Q.value = 9

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.08)
  gain.gain.setValueAtTime(0.16, now + dur - 0.25)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  osc.connect(band).connect(gain).connect(ac.destination)
  osc.start(now)
  lfo.start(now)
  osc.stop(now + dur)
  lfo.stop(now + dur)
}

/** Quieter than the first cut; the partial levels below stay as designed. */
const BELL_VOLUME = 0.4

/** Inharmonic partials with long decays: a small church bell. */
export function playBell(): void {
  const ac = audio()
  const now = ac.currentTime
  const base = 523.25
  const partials: [ratio: number, level: number, decay: number][] = [
    [0.5, 0.05, 2.4],
    [1, 0.12, 2.0],
    [1.19, 0.05, 1.5],
    [1.56, 0.04, 1.2],
    [2, 0.05, 1.0],
    [2.74, 0.025, 0.7]
  ]
  for (const [ratio, level, decay] of partials) {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = base * ratio
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(level * BELL_VOLUME, now + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay)
    osc.connect(g).connect(ac.destination)
    osc.start(now)
    osc.stop(now + decay)
  }
}
