import { KINETIC } from './timing.ts'
import type { BrandColors, FontSpec, Look } from './types'

type Rgb = [number, number, number]

const parse = (hex: string): Rgb => {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? [...raw].map((digit) => digit + digit).join('') : raw.slice(0, 6)
  const value = Number.parseInt(full, 16)
  return Number.isNaN(value) ? [0, 0, 0] : [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const toHex = ([r, g, b]: Rgb): string => `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`

/** Relative luminance (WCAG), from 0 (black) to 1 (white). */
export const luminance = (hex: string): number => {
  const [r, g, b] = parse(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** `amount` of `b` mixed into `a`, from 0 to 1. */
export const mix = (a: string, b: string, amount: number): string => {
  const [from, to] = [parse(a), parse(b)]
  return toHex(from.map((channel, index) => channel + ((to[index] ?? 0) - channel) * amount) as Rgb)
}

export const alpha = (hex: string, opacity: number): string => {
  const [r, g, b] = parse(hex)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/** What a look is made of. The shots never ask which look they are in: they read these. */
interface Traits {
  /** What is behind the text. */
  backdrop: 'glow' | 'stripes' | 'grid' | 'scanlines' | 'mesh' | 'rules' | 'terminal' | 'dots' | 'bars' | 'rays'
  /** How a word arrives. */
  motion: 'pop' | 'slam' | 'rise' | 'type' | 'blur' | 'flicker' | 'bounce'
  /** How the words that matter stand out. `auto`: each shot's own way. */
  emphasis: 'auto' | 'box' | 'quiet' | 'glow' | 'italic' | 'sticker' | 'shadow'
  /** Which typeface the big text is set in. */
  face: 'display' | 'serif' | 'mono'
  displayWeight: number
  uppercase: boolean
  /** Space between letters, in em. */
  tracking: number
  /** How much bigger or smaller the type is than in the brand look. */
  scale: number
  /** Light around the text, as from a neon tube. */
  textGlow: boolean
  /** Thick outlines and hard shadows instead of soft glows. */
  hardEdges: boolean
  /**
   * The video is cut like a showreel: the hook is thrown word by word, bands of text run
   * behind the pains, shapes burst. False for the looks whose whole point is to stay calm.
   */
  kinetic: boolean
  /** Lines shake as they land, confetti flies, an orbit turns in the hook. */
  shake: boolean
  confetti: boolean
  orbit: boolean
}

export interface Theme extends Traits {
  look: Look
  /** The stage most shots play on. */
  bg: string
  text: string
  muted: string
  /** The brand's colour: it highlights words, and floods the frame when the product appears. */
  primary: string
  onPrimary: string
  /** What the product's own shots are painted with. Same as `bg` in looks that do not flood. */
  flood: string
  onFlood: string
  /** Colours that read well on the stage, brand first: one per feature, in turn. */
  accents: [string, ...string[]]
  /** The brand's colours as they are, for looks that paint with them. */
  brand: [string, ...string[]]
  display: string
  body: string
  /** Bricolage Grotesque is drawn narrower than its default: it lets the type be bigger. */
  displayStretch: string
}

const DARK = '#08080d'
const LIGHT = '#ffffff'
const INK = '#101014'

/** `color`, moved towards `ink` until it stands out on `bg`. */
const readableOn = (color: string, bg: string, ink: string, enough = 3): string => {
  let result = color
  for (let step = 1; step <= 10 && contrast(result, bg) < enough; step += 1) result = mix(color, ink, step / 10)
  return result
}

const BRAND_TRAITS: Traits = {
  backdrop: 'glow',
  motion: 'pop',
  emphasis: 'auto',
  face: 'display',
  displayWeight: 800,
  uppercase: false,
  tracking: -0.035,
  scale: 1,
  textGlow: false,
  hardEdges: false,
  kinetic: true,
  shake: true,
  confetti: true,
  orbit: true,
}

/** Each look, as what it changes from the brand look. */
const TRAITS: Record<Look, Partial<Traits>> = {
  brand: {},
  // Flat blocks of colour, capitals, hard cuts.
  impact: { backdrop: 'stripes', motion: 'slam', emphasis: 'box', uppercase: true, tracking: -0.02, orbit: false },
  // Ink on paper, calm moves.
  minimal: { backdrop: 'grid', motion: 'rise', emphasis: 'quiet', displayWeight: 600, scale: 0.84, shake: false, confetti: false, orbit: false },
  // Tubes of light in the dark.
  neon: { backdrop: 'scanlines', motion: 'flicker', emphasis: 'glow', displayWeight: 700, textGlow: true, shake: false, orbit: false },
  // The brand's colours melting into each other.
  gradient: { backdrop: 'mesh', motion: 'blur', emphasis: 'box', shake: false, orbit: false },
  // A magazine page: a serif, italics, thin rules.
  editorial: { backdrop: 'rules', motion: 'rise', emphasis: 'italic', face: 'serif', displayWeight: 560, tracking: -0.03, scale: 0.96, shake: false, confetti: false, orbit: false },
  // A command line: one typeface, typed out.
  terminal: { backdrop: 'terminal', motion: 'type', emphasis: 'box', face: 'mono', displayWeight: 700, tracking: -0.04, scale: 0.8, shake: false, confetti: false, orbit: false },
  // Pastel blocks, stickers, thick outlines.
  pop: { backdrop: 'dots', motion: 'bounce', emphasis: 'sticker', hardEdges: true, orbit: false },
  // Wide capitals between black bars.
  cinema: { backdrop: 'bars', motion: 'blur', emphasis: 'quiet', displayWeight: 600, uppercase: true, tracking: 0.07, scale: 0.72, shake: false, confetti: false, orbit: false },
  // Cut-out paper: the nearest the ready-made shots get to a hand-made collage.
  collage: { backdrop: 'dots', motion: 'bounce', emphasis: 'sticker', scale: 0.96, hardEdges: true, shake: false, orbit: false },
  // A poster: sun rays, capitals with a hard shadow.
  retro: { backdrop: 'rays', motion: 'bounce', emphasis: 'shadow', uppercase: true, tracking: -0.01, scale: 0.94, hardEdges: true, shake: false, orbit: false },
}

type Fonts = { display: FontSpec; body: FontSpec; serif?: FontSpec; mono?: FontSpec }

/** The colours of a look, from the brand's. */
const palette = (look: Look, colors: BrandColors) => {
  const brand = [...new Set([colors.primary, colors.secondary, colors.accent].filter((color): color is string => Boolean(color)))] as [string, ...string[]]
  const on = (bg: string, text: string, accents: string[], flood = bg, onFlood = text) => ({
    bg,
    text,
    muted: mix(text, bg, 0.42),
    primary: accents[0] ?? text,
    onPrimary: bg,
    flood,
    onFlood,
    accents: (accents.length > 0 ? accents : [text]) as [string, ...string[]],
    brand,
  })
  /** The brand's colours, pushed towards `ink` until they read on `bg`. */
  const tuned = (bg: string, ink: string, enough = 3) => brand.map((color) => readableOn(color, bg, ink, enough))
  /** Whichever of two inks reads best on a colour. */
  const inkFor = (color: string, dark = DARK, light = LIGHT) => (contrast(dark, color) >= contrast(light, color) ? dark : light)

  switch (look) {
    case 'minimal':
    case 'editorial': {
      const paper = look === 'editorial' ? '#faf7f2' : '#f5f5f2'
      const bg = colors.background && luminance(colors.background) > 0.7 ? colors.background : paper
      const text = colors.text && contrast(colors.text, bg) >= 10 ? colors.text : INK
      return on(bg, text, tuned(bg, text))
    }
    case 'neon':
      // Black, so that the colours are the only light.
      return on('#04040a', LIGHT, tuned('#04040a', LIGHT, 5))
    case 'cinema':
      return on('#000000', '#f1ede6', tuned('#000000', LIGHT, 5))
    case 'terminal': {
      const bg = colors.background && luminance(colors.background) < 0.05 ? colors.background : '#0a0d0c'
      return on(bg, '#e3ebe6', tuned(bg, LIGHT, 5))
    }
    case 'gradient': {
      // The text sits on the colours themselves. They stay as vivid as they are: the ink is
      // whichever reads on all of them, and a colour is only shifted if the ink cannot be read on it.
      const worst = (ink: string) => Math.min(...brand.map((color) => contrast(ink, color)))
      const ink = worst(DARK) >= worst(LIGHT) ? DARK : LIGHT
      const vivid = brand.map((color) => readableOn(color, ink, ink === DARK ? LIGHT : '#000000', 4.5)) as [string, ...string[]]
      return { ...on(mix(vivid[0], vivid[1] ?? vivid[0], 0.5), ink, [ink]), brand: vivid }
    }
    case 'pop': {
      const bg = mix(brand[0], LIGHT, 0.74)
      return on(bg, INK, brand, brand[0], inkFor(brand[0], INK))
    }
    case 'collage': {
      const bg = '#efe6d5'
      const text = '#1d1a16'
      return on(bg, text, tuned(bg, text), brand[0], inkFor(brand[0], text, bg))
    }
    case 'retro': {
      const bg = '#f4ead7'
      const text = '#2b1d16'
      return on(bg, text, tuned(bg, text), brand[0], inkFor(brand[0], text, bg))
    }
    case 'brand':
    case 'impact': {
      const bg = colors.background ?? DARK
      const text = colors.text && contrast(colors.text, bg) >= 7 ? colors.text : luminance(bg) > 0.4 ? DARK : LIGHT
      // On the stage, a colour must stand out; the first that does leads.
      const readable = brand.filter((color) => contrast(color, bg) >= 3)
      const ink = inkFor(colors.primary, bg, text)
      const onFlood = contrast(ink, colors.primary) >= 4.5 ? ink : inkFor(colors.primary)
      return { ...on(bg, text, readable, colors.primary, onFlood), primary: colors.primary, onPrimary: onFlood }
    }
  }
}

export const makeTheme = (colors: BrandColors, fonts: Fonts, look: Look = 'brand'): Theme => {
  const traits = { ...BRAND_TRAITS, ...TRAITS[look] }
  const face = (traits.face === 'serif' ? fonts.serif : traits.face === 'mono' ? fonts.mono : undefined) ?? fonts.display
  const fallback = traits.face === 'serif' ? 'Georgia, serif' : traits.face === 'mono' ? 'ui-monospace, monospace' : 'system-ui, sans-serif'

  return {
    look,
    ...traits,
    kinetic: KINETIC[look],
    ...palette(look, colors),
    display: `"${face.family}", ${fallback}`,
    body: `"${(traits.face === 'mono' ? face : fonts.body).family}", system-ui, sans-serif`,
    displayStretch: face.family === 'Bricolage Grotesque' ? '82%' : '100%',
  }
}

/**
 * The theme one shot plays in. Two looks paint each shot in a colour of its own: impact
 * gives the pains and the features a block of the brand's colours, pop gives every shot a pastel.
 */
export const shotTheme = (theme: Theme, kind: string, featureIndex = 0): Theme => {
  const index = kind === 'pain' ? 1 : kind === 'feature' ? featureIndex : kind === 'benefit' ? 2 : 0

  if (theme.look === 'impact' && (kind === 'pain' || kind === 'feature')) {
    const bg = accentAt(theme, index)
    const text = inkOn(theme, bg)
    // On a block of colour, the only accent left is the ink itself.
    return { ...theme, bg, text, muted: mix(text, bg, 0.35), accents: [text] }
  }
  if (theme.look === 'pop' && kind !== 'reveal' && kind !== 'cta') {
    const color = theme.brand[index % theme.brand.length] ?? theme.brand[0]
    const bg = mix(color, LIGHT, 0.74)
    // The sticker of a shot is the colour its paper is a tint of.
    return { ...theme, bg, muted: mix(theme.text, bg, 0.4), accents: [color, ...theme.brand] }
  }
  return theme
}

/** The accent of the n-th thing, cycling through the brand's colours. */
export const accentAt = (theme: Theme, index: number): string => theme.accents[index % theme.accents.length] ?? theme.accents[0]

/** The colour text takes on top of `color`: whichever of the stage's two inks reads best. */
export const inkOn = (theme: Theme, color: string): string =>
  contrast(theme.bg, color) >= contrast(theme.text, color) ? theme.bg : theme.text
