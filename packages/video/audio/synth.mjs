// A small synthesiser: every sound of a video is computed here, sample by sample.
// Nothing is recorded or downloaded, so nothing needs a licence.

export const SAMPLE_RATE = 44_100
const TAU = Math.PI * 2

/** Deterministic noise: the same video always sounds the same. */
const noiseSource = (seed = 1) => {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 2_147_483_648 - 1
  }
}

const samples = (seconds) => new Float32Array(Math.max(1, Math.round(seconds * SAMPLE_RATE)))

/** Fills a buffer from a function of time (seconds) and position (0 to 1). */
const render = (seconds, at) => {
  const out = samples(seconds)
  for (let i = 0; i < out.length; i += 1) out[i] = at(i / SAMPLE_RATE, i / out.length, i)
  return out
}

const decay = (time, halfLife) => 0.5 ** (time / halfLife)
/** A fast rise, so that no sound starts with a click. */
const attack = (time, seconds = 0.004) => Math.min(1, time / seconds)
const glide = (from, to, position) => from * (to / from) ** position

/** A band of noise whose centre moves: the body of every whoosh, hat and clap. */
const bandNoise = (seconds, { from, to = from, q = 1.2, seed = 7, shape }) => {
  const noise = noiseSource(seed)
  let [low, band] = [0, 0]
  return render(seconds, (time, position) => {
    const f = 2 * Math.sin((Math.PI * Math.min(glide(from, to, position), SAMPLE_RATE / 6.5)) / SAMPLE_RATE)
    const high = noise() - low - band / q
    band += f * high
    low += f * band
    return band * shape(time, position)
  })
}

const sine = (seconds, frequency, shape) => {
  let phase = 0
  return render(seconds, (time, position) => {
    phase += (TAU * frequency(time, position)) / SAMPLE_RATE
    return Math.sin(phase) * shape(time, position)
  })
}

// ── Drums ───────────────────────────────────────────────────────────────────

export const kick = () => sine(0.42, (time) => 44 + 96 * decay(time, 0.028), (time) => attack(time, 0.002) * decay(time, 0.085))

export const clap = () =>
  bandNoise(0.26, {
    from: 1700,
    q: 0.9,
    seed: 11,
    // Three quick slaps, then the tail.
    shape: (time) => (time < 0.03 ? [1, 0.25, 0.9][Math.floor(time / 0.01)] ?? 1 : decay(time - 0.03, 0.045)) * 0.9,
  })

export const hat = (open = false) => {
  const noise = noiseSource(open ? 5 : 3)
  let previous = 0
  return render(open ? 0.2 : 0.06, (time) => {
    const white = noise()
    const high = white - previous
    previous = white
    return high * 0.5 * attack(time, 0.001) * decay(time, open ? 0.05 : 0.012)
  })
}

// ── Notes ───────────────────────────────────────────────────────────────────

/** A sub bass note: felt more than heard. */
export const bass = (frequency, seconds) =>
  sine(
    seconds,
    () => frequency,
    (time, position) => attack(time, 0.008) * Math.min(1, (1 - position) * 12) * 0.9,
  )

/** A plucked chord: bright at first, then closing, like a muted synth stab. */
export const pluck = (frequencies, seconds, brightness = 1) => {
  const phases = frequencies.flatMap((frequency) => [frequency * 0.996, frequency * 1.004]).map((frequency) => ({ frequency, phase: Math.random() * 0 }))
  let filtered = 0
  return render(seconds, (time) => {
    let value = 0
    for (const voice of phases) {
      voice.phase = (voice.phase + voice.frequency / SAMPLE_RATE) % 1
      value += voice.phase * 2 - 1
    }
    // The filter closes as the note dies: that is what makes it a pluck.
    const cutoff = 500 + 4200 * brightness * decay(time, 0.07)
    filtered += (1 - Math.exp((-TAU * cutoff) / SAMPLE_RATE)) * (value / phases.length - filtered)
    return filtered * attack(time, 0.003) * decay(time, 0.13)
  })
}

/** A small bell, for sparkles. */
export const bell = (frequency, seconds = 0.5) =>
  render(seconds, (time) => (Math.sin(TAU * frequency * time) + 0.35 * Math.sin(TAU * frequency * 2.76 * time)) * attack(time, 0.002) * decay(time, 0.07) * 0.6)

// ── Effects ─────────────────────────────────────────────────────────────────

/** Air moving past: what a slide or a wipe sounds like. `rising` sweeps up, otherwise down. */
export const whoosh = (seconds, rising = true) =>
  bandNoise(seconds, {
    from: rising ? 320 : 5200,
    to: rising ? 5200 : 320,
    q: 1.1,
    seed: rising ? 21 : 23,
    shape: (_, position) => Math.sin(Math.PI * position ** 0.8) ** 2,
  })

/** A word or a tile popping into place. `pitch` shifts it: higher sounds lighter. */
export const pop = (pitch = 1) =>
  sine(
    0.16,
    (time) => 420 * pitch * (1 + 1.1 * decay(time, 0.012)),
    (time) => attack(time, 0.002) * decay(time, 0.03),
  )

/** Something heavy landing: the pains. */
export const thud = (pitch = 1) => {
  const body = sine(0.4, (time) => (46 + 60 * decay(time, 0.03)) * pitch, (time) => attack(time, 0.002) * decay(time, 0.07))
  const slap = bandNoise(0.09, { from: 900 * pitch, q: 0.8, seed: 31, shape: (time) => decay(time, 0.012) * 0.5 })
  return layer(body, slap)
}

/** Tension building up before the product appears. */
export const riser = (seconds) => {
  const air = bandNoise(seconds, { from: 400, to: 7000, q: 1.6, seed: 41, shape: (_, position) => position ** 2.2 })
  const tone = sine(seconds, (_, position) => glide(180, 1100, position ** 1.4), (_, position) => position ** 2.5 * 0.35)
  return layer(air, tone)
}

/** The product lands: a deep drop under a bright crash. */
export const impact = () => {
  const drop = sine(1.4, (time) => 34 + 50 * decay(time, 0.09), (time) => attack(time, 0.003) * decay(time, 0.24))
  const crash = bandNoise(0.9, { from: 5200, to: 1400, q: 0.7, seed: 51, shape: (time) => attack(time, 0.002) * decay(time, 0.13) * 0.55 })
  return layer(drop, crash)
}

/** A button being pressed. */
export const click = () => {
  const snap = bandNoise(0.03, { from: 3600, q: 0.7, seed: 61, shape: (time) => decay(time, 0.004) })
  const tone = sine(0.08, () => 1250, (time) => attack(time, 0.001) * decay(time, 0.012) * 0.6)
  return layer(snap, tone)
}

/** Adds sounds that start together into one. */
export function layer(...sounds) {
  const out = new Float32Array(Math.max(...sounds.map((sound) => sound.length)))
  for (const sound of sounds) for (let i = 0; i < sound.length; i += 1) out[i] += sound[i]
  return out
}

// ── Mixing ──────────────────────────────────────────────────────────────────

/** A stereo tape: sounds are placed on it at a time, a level and a position. */
export class Tape {
  constructor(seconds) {
    this.seconds = seconds
    this.left = samples(seconds)
    this.right = samples(seconds)
    // What is sent to the reverb.
    this.sendLeft = samples(seconds)
    this.sendRight = samples(seconds)
  }

  /**
   * `pan`: -1 (left) to 1 (right), or a function of the sound's position for a sound that travels.
   * `space`: how much of it goes to the reverb. `duck`: a function of time that lowers it (see `ducking`).
   */
  add(sound, time, { gain = 1, pan = 0, space = 0, duck } = {}) {
    const start = Math.round(time * SAMPLE_RATE)
    for (let i = 0; i < sound.length; i += 1) {
      const at = start + i
      if (at < 0) continue
      if (at >= this.left.length) break
      const where = typeof pan === 'function' ? pan(i / sound.length) : pan
      const angle = ((where + 1) * Math.PI) / 4
      const value = sound[i] * gain * (duck ? duck(at / SAMPLE_RATE) : 1)
      this.left[at] += value * Math.cos(angle)
      this.right[at] += value * Math.sin(angle)
      if (space > 0) {
        this.sendLeft[at] += value * space * Math.cos(angle)
        this.sendRight[at] += value * space * Math.sin(angle)
      }
    }
  }

  /** The finished mix: reverb added, peaks tamed, and a short fade so the end never clicks. */
  master({ level = 0.9, fadeOut = 0.25 } = {}) {
    const wetLeft = reverb(this.sendLeft, 0)
    const wetRight = reverb(this.sendRight, 23)
    const fadeFrom = this.left.length - Math.round(fadeOut * SAMPLE_RATE)

    let peak = 0
    for (const [dry, wet] of [
      [this.left, wetLeft],
      [this.right, wetRight],
    ]) {
      for (let i = 0; i < dry.length; i += 1) {
        const fade = i > fadeFrom ? (dry.length - i) / (dry.length - fadeFrom) : 1
        // Loud moments are rounded off rather than cut flat.
        dry[i] = Math.tanh((dry[i] + wet[i]) * 1.15) * fade
        peak = Math.max(peak, Math.abs(dry[i]))
      }
    }
    // Never raised: a quiet effect must stay quiet. Only brought down if it would clip.
    const scale = peak > level ? level / peak : 1
    for (const channel of [this.left, this.right]) for (let i = 0; i < channel.length; i += 1) channel[i] *= scale
    return this
  }

  /** 16-bit stereo WAV. */
  toWav() {
    const frames = this.left.length
    const buffer = Buffer.alloc(44 + frames * 4)
    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + frames * 4, 4)
    buffer.write('WAVEfmt ', 8)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(2, 22)
    buffer.writeUInt32LE(SAMPLE_RATE, 24)
    buffer.writeUInt32LE(SAMPLE_RATE * 4, 28)
    buffer.writeUInt16LE(4, 32)
    buffer.writeUInt16LE(16, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(frames * 4, 40)
    for (let i = 0; i < frames; i += 1) {
      buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, this.left[i])) * 32_767), 44 + i * 4)
      buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, this.right[i])) * 32_767), 46 + i * 4)
    }
    return buffer
  }
}

/** Lowers whatever uses it each time a kick hits, so the kick is never buried. */
export const ducking = (kickTimes, depth = 0.6, recovery = 0.2) => {
  const times = [...kickTimes].sort((a, b) => a - b)
  return (time) => {
    let last = -Infinity
    for (const kickTime of times) {
      if (kickTime > time) break
      last = kickTime
    }
    const since = time - last
    return since >= recovery ? 1 : 1 - depth * (1 - since / recovery) ** 2
  }
}

/** A small room: four echoes that feed back, then two that blur them. */
function reverb(input, offset) {
  const out = new Float32Array(input.length)
  for (const [delay, feedback] of [
    [1557, 0.8],
    [1617, 0.79],
    [1491, 0.81],
    [1422, 0.78],
  ]) {
    const line = new Float32Array(delay + offset)
    let [index, damped] = [0, 0]
    for (let i = 0; i < input.length; i += 1) {
      const echoed = line[index]
      damped = echoed * 0.7 + damped * 0.3
      line[index] = input[i] + damped * feedback
      index = (index + 1) % line.length
      out[i] += echoed * 0.25
    }
  }
  for (const delay of [225, 556]) {
    const line = new Float32Array(delay + offset)
    let index = 0
    for (let i = 0; i < out.length; i += 1) {
      const delayed = line[index]
      const value = out[i] + delayed * 0.5
      line[index] = value
      index = (index + 1) % line.length
      out[i] = delayed - value * 0.5
    }
  }
  return out
}
