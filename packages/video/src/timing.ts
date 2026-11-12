// When things happen in a video. Pure: no React, no browser. The shots read it to move,
// and the render script reads it to put each sound exactly where its move is.
import { FPS, type Look, type Scene } from './types.ts'
import { countWords, tokenize } from './words.ts'

export const sceneFrames = (scene: Scene, fps: number = FPS): number => Math.max(1, Math.round(scene.seconds * fps))

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** Frames between two words so that `words` are all on screen within `frames`. */
export const staggerFor = (words: number, frames: number): number => clamp(frames / Math.max(1, words), 1.4, 3.6)

/**
 * How each look goes from one shot to the next. `mixed`: slides, a zoom, and a burst of
 * colour for the product. `snap`: hard cuts. `fade`: dissolves.
 */
export const CUTS: Record<Look, 'mixed' | 'snap' | 'fade'> = {
  brand: 'mixed',
  impact: 'snap',
  minimal: 'fade',
  neon: 'snap',
  gradient: 'mixed',
  editorial: 'fade',
  terminal: 'snap',
  pop: 'mixed',
  cinema: 'fade',
  retro: 'mixed',
  collage: 'mixed',
}

/** How long the cut into a shot lasts, in frames. The shot is already playing underneath. */
export const cutFrames = (kind: Scene['kind'], look: Look): number => {
  const product = kind === 'reveal' || kind === 'cta'
  switch (CUTS[look]) {
    case 'fade':
      return look === 'cinema' ? 16 : 12
    case 'snap':
      return product ? 10 : 6
    case 'mixed':
      return product ? 18 : kind === 'pain' ? 11 : kind === 'benefit' ? 10 : kind === 'hook' ? 8 : 12
  }
}

/** The hook's words: the first is already arriving on the very first frame. */
export const hookWords = (text: string, frames: number) => ({ at: -2, stagger: staggerFor(countWords(text), frames * 0.42) })

/** The looks cut like a showreel. The others keep their calm, and the hook is simply written out. */
export const KINETIC: Record<Look, boolean> = {
  brand: true,
  impact: true,
  minimal: false,
  neon: true,
  gradient: true,
  editorial: false,
  terminal: true,
  pop: true,
  cinema: false,
  retro: true,
  collage: true,
}

/**
 * The beats of a kinetic hook: each word is thrown at the viewer alone, filling the frame,
 * for a few frames (longer for the words that matter); then the whole sentence assembles
 * and holds. Returns when each word starts, and when the sentence assembles.
 */
export const hookBeats = (text: string, frames: number) => {
  // A small word ("du", "à", "the") is not thrown alone: it goes with the word it leads to.
  const tokens: { text: string; emphasis: boolean }[] = []
  let leading = ''
  for (const token of tokenize(text)) {
    if (!token.emphasis && token.text.length <= 3 && !/[.?!…]$/.test(token.text)) leading += `${token.text} `
    else {
      tokens.push({ text: leading + token.text, emphasis: token.emphasis })
      leading = ''
    }
  }
  if (leading) tokens.push({ text: leading.trim(), emphasis: false })

  const wanted = tokens.map((token) => (token.emphasis ? 8.5 : 5.5))
  // The words never take more than about half of the shot: the sentence must be read whole.
  const room = frames * 0.56
  const scale = Math.min(1, room / wanted.reduce((sum, beat) => sum + beat, 0))
  let at = 0
  const starts = wanted.map((beat) => {
    const start = at
    at += Math.max(3, beat * scale)
    return Math.round(start)
  })
  return { tokens, starts, assemble: Math.round(at) }
}

/** When each pain line lands: each gets a share of the shot in proportion to its length. */
export const painStarts = (lines: readonly string[], frames: number, enter: number): number[] => {
  const weights = lines.map((line) => Math.max(5, countWords(line) + 2.3))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const first = Math.round(enter * 0.5) + 2
  const span = frames - first - 8
  let elapsed = 0
  return weights.map((weight) => {
    const start = first + (span * elapsed) / total
    elapsed += weight
    return Math.round(start)
  })
}

/** When the logo lands on the product's shots. */
export const logoLands = (enter: number): number => Math.round(enter * 0.6)

/** When the call to action's button is pressed into place. */
export const buttonLands = (enter: number): number => logoLands(enter) + 16

/** When the pointer that came for the button clicks it. */
export const buttonClicked = (enter: number): number => buttonLands(enter) + 30

/** When a feature's interface opens, and when its title starts: once the interface has begun to play. */
export const featureStarts = (enter: number) => {
  const tile = Math.round(enter * 0.6)
  return { tile, title: tile + 14 }
}

export const benefitStarts = (enter: number): number => Math.round(enter * 0.5)

/** When the phone of the demo shot arrives. */
export const demoStarts = (enter: number): number => Math.round(enter * 0.5)

/** The frames at which the highlighted words of a text land, given when its first word does. */
export const emphasisFrames = (text: string, at: number, stagger: number): number[] =>
  tokenize(text).flatMap((token, index) => (token.emphasis ? [at + index * stagger] : []))
