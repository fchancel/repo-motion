// Writes the soundtrack of one video: a sound on everything that moves, and, if asked,
// a rhythm underneath whose drop falls exactly when the product appears.
//
// Times come from `src/timing.ts`, the file the shots themselves read: a sound and its
// move cannot drift apart.
import {
  benefitStarts,
  buttonClicked,
  buttonLands,
  CUTS,
  cutFrames,
  demoStarts,
  emphasisFrames,
  featureStarts,
  hookBeats,
  hookWords,
  KINETIC,
  logoLands,
  painStarts,
  sceneFrames,
} from '../src/timing.ts'
import { FPS } from '../src/types.ts'
import { bass, bell, click, clap, ducking, hat, impact, kick, pluck, pop, riser, Tape, thud, whoosh } from './synth.mjs'

const seconds = (frames) => frames / FPS

/** When each shot starts, how long it lasts and how long the cut into it takes, in frames. */
const timeline = (scenes, look) => {
  let start = 0
  return scenes.map((scene, index) => {
    const shot = { scene, start, frames: sceneFrames(scene), enter: index === 0 ? 0 : cutFrames(scene.kind, look) }
    start += shot.frames
    return shot
  })
}

/** How loud the effects are in each look: some hit, some whisper. */
const LEVELS = { brand: 1, impact: 1.2, minimal: 0.55, neon: 1.1, gradient: 0.9, editorial: 0.5, terminal: 0.8, pop: 1.1, cinema: 0.7, retro: 1, collage: 0.9 }
/** The looks where the benefit is a burst of confetti, and so a run of bells; elsewhere, one bell. */
const FESTIVE = ['brand', 'impact', 'neon', 'gradient', 'pop', 'retro', 'collage']

/** A sound on everything that moves. */
const addEffects = (tape, shots, look, withBeat) => {
  const level = (LEVELS[look] ?? 1) * (withBeat ? 0.8 : 1)
  let features = 0

  for (const { scene, start, frames, enter } of shots) {
    const at = (frame) => seconds(start + frame)
    const cut = seconds(enter)

    // The cut itself: air moving, or, in the impact look, a hit.
    if (enter > 0 && scene.kind !== 'reveal' && scene.kind !== 'cta') {
      if (CUTS[look] === 'snap') tape.add(thud(1.5), at(0), { gain: 0.5 * level })
      else {
        const rightwards = scene.kind === 'feature' || scene.kind === 'demo'
        tape.add(whoosh(cut + 0.22, scene.kind !== 'benefit'), at(0) - 0.05, {
          gain: 0.34 * level,
          pan: rightwards ? (position) => 0.7 - position * 1.4 : 0,
          space: 0.2,
        })
      }
    }

    switch (scene.kind) {
      case 'hook': {
        if (KINETIC[look]) {
          // Each word is thrown alone: a tick for each, a hit for those that flood the frame.
          const { tokens, starts, assemble } = hookBeats(scene.text, frames)
          starts.forEach((frame, index) => {
            if (tokens[index].emphasis) tape.add(thud(1.25), at(frame), { gain: 0.5 * level, space: 0.15 })
            else tape.add(pop(0.9 + (index % 3) * 0.12), at(frame), { gain: 0.24 * level, pan: index % 2 === 0 ? -0.3 : 0.3 })
          })
          // The sentence assembling.
          tape.add(whoosh(0.32, false), at(assemble) - 0.08, { gain: 0.3 * level, space: 0.2 })
          tape.add(pop(1.4), at(assemble), { gain: 0.36 * level, space: 0.25 })
          break
        }
        tape.add(whoosh(0.4), 0, { gain: 0.28 * level, space: 0.2 })
        const { at: first, stagger } = hookWords(scene.text, frames)
        for (const frame of emphasisFrames(scene.text, first, stagger)) {
          tape.add(pop(1.25), Math.max(0, at(frame)), { gain: 0.32 * level, pan: 0.15, space: 0.15 })
        }
        break
      }
      case 'pain': {
        // Each line lands lower than the one before: it gets worse.
        painStarts(scene.lines, frames, enter).forEach((frame, index) => {
          tape.add(thud(1 - index * 0.11), at(frame), { gain: 0.62 * level, space: 0.12 })
        })
        break
      }
      case 'reveal':
      case 'cta': {
        const lands = at(logoLands(enter))
        if (scene.kind === 'reveal') {
          const build = Math.min(0.9, seconds(start) * 0.6)
          tape.add(riser(build + cut * 0.4), at(0) - build, { gain: 0.3 * level, space: 0.25 })
        } else {
          tape.add(whoosh(cut + 0.2), at(0) - 0.05, { gain: 0.3 * level, space: 0.2 })
        }
        tape.add(impact(), lands, { gain: (scene.kind === 'reveal' ? 0.8 : 0.5) * level, space: 0.35 })
        tape.add(pluck([440, 554.37, 659.25, 880], 1.6, 1.4), lands, { gain: 0.26 * level, space: 0.7 })
        if (scene.kind === 'cta') {
          tape.add(pop(1.1), at(buttonLands(enter)), { gain: 0.3 * level, space: 0.15 })
          // The pointer clicking the button.
          tape.add(click(), at(buttonClicked(enter)), { gain: 0.6 * level, space: 0.1 })
          tape.add(thud(1.7), at(buttonClicked(enter)), { gain: 0.3 * level })
        }
        break
      }
      case 'demo': {
        const first = demoStarts(enter)
        tape.add(whoosh(0.5), at(first), { gain: 0.22 * level, space: 0.2 })
        break
      }
      case 'feature': {
        const { tile, title } = featureStarts(enter)
        // Each feature pops a little higher than the last: it keeps getting better.
        tape.add(whoosh(0.34), at(tile) - 0.04, { gain: 0.2 * level, space: 0.2 })
        tape.add(pop(0.8 + features * 0.12), at(tile) + 0.1, { gain: 0.5 * level, pan: -0.35, space: 0.2 })
        // What happens in the interface: a soft tick for each of its lines.
        ;(scene.visual?.items ?? []).slice(0, 4).forEach((_, index) => {
          tape.add(pop(1.6 + index * 0.1), at(tile + 22 + index * 11), { gain: 0.14 * level, pan: 0.2 })
        })
        const words = hookWords(scene.title, 13 / 0.42).stagger
        for (const frame of emphasisFrames(scene.title, title, words)) tape.add(pop(1.5), at(frame), { gain: 0.22 * level, space: 0.15 })
        features += 1
        break
      }
      case 'benefit': {
        const first = at(benefitStarts(enter) + 2)
        if (!FESTIVE.includes(look)) tape.add(bell(1318.5, 0.8), first, { gain: 0.22 * level, space: 0.6 })
        else {
          // A run of bells going up, as the confetti flies.
          ;[1046.5, 1318.5, 1568, 2093, 2637, 3136].forEach((frequency, index) => {
            tape.add(bell(frequency), first + index * 0.045, { gain: 0.2 * level, pan: -0.5 + index * 0.2, space: 0.6 })
          })
        }
        break
      }
    }
  }
}

/** A minor, F, C, G: one chord per bar, and the note the bass plays under each. */
const CHORDS = [
  { root: 55, notes: [220, 261.63, 329.63] },
  { root: 43.65, notes: [174.61, 220, 261.63] },
  { root: 65.41, notes: [196, 261.63, 329.63] },
  { root: 49, notes: [196, 246.94, 293.66] },
]

/**
 * A tempo at which the product appears exactly on a beat, on a bar line when one is within
 * reach: the rhythm then drops with the reveal instead of beside it.
 */
const tempoFor = (dropSeconds) => {
  const fits = (beats) => {
    const bpm = (60 * beats) / dropSeconds
    return bpm >= 94 && bpm <= 122 ? bpm : null
  }
  const candidates = Array.from({ length: 64 }, (_, index) => index + 1)
  const beats = candidates.find((count) => count % 4 === 0 && fits(count)) ?? candidates.find((count) => count % 2 === 0 && fits(count)) ?? candidates.find(fits)
  return beats ? { bpm: fits(beats), beatsBeforeDrop: beats } : { bpm: 104, beatsBeforeDrop: Math.round((dropSeconds * 104) / 60) }
}

/** The rhythm: held back while the pain is told, released when the product appears. */
const addBeat = (tape, shots) => {
  const reveal = shots.find((shot) => shot.scene.kind === 'reveal')
  const dropSeconds = reveal ? seconds(reveal.start + logoLands(reveal.enter)) : 0
  const { bpm, beatsBeforeDrop } = dropSeconds > 1 ? tempoFor(dropSeconds) : { bpm: 104, beatsBeforeDrop: 0 }
  const beat = 60 / bpm
  const origin = dropSeconds - beatsBeforeDrop * beat
  // The last second is left to the final chord.
  const end = tape.seconds - 0.9

  const kicks = []
  for (let index = 0; origin + index * beat < end; index += 1) {
    if (index >= beatsBeforeDrop || index % 4 === 0) kicks.push(origin + index * beat)
  }
  // The beat just before the drop is left empty: the silence is what makes the drop land.
  const played = kicks.filter((time) => time < dropSeconds - beat * 1.5 || time >= dropSeconds - 0.001)
  const duck = ducking(played, 0.6, beat * 0.45)

  for (let index = 0; origin + index * beat < end; index += 1) {
    const time = origin + index * beat
    if (time < -0.01) continue
    const dropped = index >= beatsBeforeDrop
    const chord = CHORDS[Math.floor(index / 4) % CHORDS.length]
    const inBar = index % 4
    const beforeGap = time < dropSeconds - beat * 1.5

    if (dropped) {
      tape.add(kick(), time, { gain: 0.95 })
      if (inBar === 1 || inBar === 3) tape.add(clap(), time, { gain: 0.42, space: 0.3 })
      tape.add(hat(), time + beat / 2, { gain: 0.3, pan: 0.25 })
      tape.add(hat(), time + beat * 0.75, { gain: 0.12, pan: -0.25 })
      if (inBar === 3) tape.add(hat(true), time + beat / 2, { gain: 0.2, pan: 0.25 })
      // The bass plays on the off-beats, where the kick leaves it room.
      tape.add(bass(chord.root, beat * 0.42), time + beat / 2, { gain: 0.5, duck })
      tape.add(bass(chord.root, beat * 0.2), time + beat * 0.75, { gain: 0.32, duck })
      // Chords on 1, the "and" of 2 and 4: the push-pull every pop record uses.
      if (inBar === 0 || inBar === 3) tape.add(pluck(chord.notes, beat * 1.6), time, { gain: 0.3, pan: -0.2, space: 0.45, duck })
      if (inBar === 1) tape.add(pluck(chord.notes, beat * 1.4), time + beat / 2, { gain: 0.26, pan: 0.2, space: 0.45, duck })
    } else if (beforeGap) {
      // Before the product appears: a heartbeat and muffled chords.
      if (inBar === 0) tape.add(kick(), time, { gain: 0.6 })
      if (inBar === 0 || inBar === 2) tape.add(pluck(chord.notes, beat * 1.8, 0.12), time, { gain: 0.34, space: 0.5, duck })
      tape.add(hat(), time + beat / 2, { gain: 0.1, pan: 0.2 })
    }
  }

  // One last chord, left to ring out.
  tape.add(pluck([220, 261.63, 329.63, 440], 1.6, 1.2), end, { gain: 0.3, space: 0.8 })
}

/**
 * The soundtrack of a video as a WAV file. `kind` is `effects` (a sound on what moves),
 * `beat` (a rhythm under them) or `track` (effects only: the user's music is mixed in by the video).
 */
export const writeSoundtrack = ({ scenes, look, kind }) => {
  const shots = timeline(scenes, look)
  const tape = new Tape(seconds(shots.reduce((total, shot) => total + shot.frames, 0)))
  if (kind === 'beat') addBeat(tape, shots)
  // Under someone's own music, effects stay discreet.
  addEffects(tape, shots, look, kind !== 'effects')
  return tape.master()
}

/** The sounds a directed video may ask for, and how loud each is by default. */
const SOUNDS = {
  whoosh: (event) => ({ sound: whoosh(event.seconds ?? 0.4, true), gain: 0.32, space: 0.2 }),
  swish: (event) => ({ sound: whoosh(event.seconds ?? 0.35, false), gain: 0.3, space: 0.2 }),
  pop: (event) => ({ sound: pop(event.pitch ?? 1), gain: 0.4, space: 0.15 }),
  tick: (event) => ({ sound: pop((event.pitch ?? 1) * 1.7), gain: 0.16, space: 0.05 }),
  thud: (event) => ({ sound: thud(event.pitch ?? 1), gain: 0.6, space: 0.12 }),
  impact: () => ({ sound: impact(), gain: 0.8, space: 0.35 }),
  riser: (event) => ({ sound: riser(Math.min(3, Math.max(0.2, event.seconds ?? 0.8))), gain: 0.3, space: 0.25 }),
  click: () => ({ sound: click(), gain: 0.55, space: 0.1 }),
  bell: (event) => ({ sound: bell(1318.5 * (event.pitch ?? 1), 0.8), gain: 0.24, space: 0.6 }),
}

const within = (value, min, max, fallback) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback)

/**
 * The soundtrack of a video Claude directed, from the score it wrote: a list of sounds
 * and when each is heard. The score is data, checked here: an unknown sound or a time
 * outside the video is simply left out.
 */
export const writeScoredSoundtrack = ({ seconds, score, kind }) => {
  const tape = new Tape(seconds)
  const events = (Array.isArray(score?.events) ? score.events : []).slice(0, 400)
  const withBeat = kind === 'beat' && score?.music !== 'none'

  if (withBeat) {
    // The rhythm is held back until the moment the score names, and released there.
    const drop = within(Number(score?.dropAt), 0, seconds, 0)
    const reveal = { scene: { kind: 'reveal' }, start: Math.round(drop * FPS), frames: 1, enter: 0 }
    addBeat(tape, drop > 1 ? [reveal] : [])
  }

  for (const event of events) {
    const at = Number(event?.at)
    const make = SOUNDS[event?.sound === 'sparkle' ? 'bell' : event?.sound]
    if (!make || !Number.isFinite(at) || at < 0 || at >= seconds) continue
    const pitch = within(Number(event.pitch), 0.5, 2, 1)
    const level = within(Number(event.gain), 0, 1, null)
    const pan = within(Number(event.pan), -1, 1, 0)
    if (event.sound === 'sparkle') {
      // A run of bells going up.
      ;[1046.5, 1318.5, 1568, 2093, 2637, 3136].forEach((frequency, index) => {
        tape.add(bell(frequency * pitch), at + index * 0.045, { gain: (level ?? 0.2) * (withBeat ? 0.8 : 1), pan: -0.5 + index * 0.2, space: 0.6 })
      })
      continue
    }
    const { sound, gain, space } = make({ ...event, pitch })
    tape.add(sound, at, { gain: (level ?? gain) * (withBeat ? 0.8 : 1), pan, space })
  }
  return tape.master()
}
