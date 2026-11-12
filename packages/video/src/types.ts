/** The contract between the application and a video: everything the composition needs to draw it. */

export type SceneContent =
  | { kind: 'hook'; text: string }
  | { kind: 'pain'; lines: string[] }
  | { kind: 'reveal'; line: string }
  | { kind: 'demo'; caption: string }
  | { kind: 'feature'; feature: string; icon: string; visual?: { type: string; items: string[] }; title: string; caption: string }
  | { kind: 'benefit'; text: string }
  | { kind: 'cta'; text: string }

/** `seconds`: how long the shot lasts. The application decides, from how long its text takes to read. */
export type Scene = SceneContent & { seconds: number }

export type SceneOf<Kind extends Scene['kind']> = Extract<Scene, { kind: Kind }>

export type FontFaceSpec = {
  /** The font file, as a data URL. */
  src: string
  /** A weight (`800`) or, for a variable font, a range (`200 800`). */
  weight: string
  style?: 'italic'
  stretch?: string
  unicodeRange?: string
}

export type FontSpec = { family: string; faces: FontFaceSpec[] }

export type BrandColors = {
  primary: string
  secondary?: string
  accent?: string
  background?: string
  text?: string
}

/** The art direction. What each one looks like is in `theme.ts`. */
export type Look = 'brand' | 'impact' | 'minimal' | 'neon' | 'gradient' | 'editorial' | 'terminal' | 'pop' | 'cinema' | 'retro' | 'collage'

export type VideoProps = {
  look: Look
  product: { name: string }
  colors: BrandColors
  /** The product's logo as a data URL, when the project has one. */
  logo: string | null
  /** `serif` and `mono` are only given to the looks that are set in them. */
  fonts: { display: FontSpec; body: FontSpec; serif?: FontSpec; mono?: FontSpec }
  scenes: Scene[]
  /** Pictures of the running application, as data URLs, for the demo shot. */
  screens: string[]
  /**
   * What is heard, as files of the bundle's public folder. `effects`: the sounds written for
   * this video (and its rhythm, if it has one). `music`: the user's own track, played under them.
   */
  audio: { effects: string | null; music: string | null }
}

/** What a video directed by Claude is given: the product's identity and its own assets. */
export type PieceProps = {
  product: { name: string }
  colors: BrandColors
  /** The product's logo as a data URL, when the project has one. */
  logo: string | null
  /** `display` is the product's own typeface when the project has it, else a grotesque. */
  fonts: { display: FontSpec; body: FontSpec; serif: FontSpec; mono: FontSpec }
  /** Pictures of the running application, as data URLs: as tall as its pages. May be empty. */
  screens: string[]
  /** The art direction the user chose for this persona. */
  look: Look
}

export const FPS = 30
export const WIDTH = 1080
export const HEIGHT = 1920

/**
 * Where text may go. Platforms cover the top of the frame with their tabs, the bottom with
 * the caption and the right edge with their buttons: nothing that must be read goes there.
 */
export const SAFE = { left: 96, right: 96, top: 290, bottom: 500 } as const
export const SAFE_WIDTH = WIDTH - SAFE.left - SAFE.right
export const SAFE_HEIGHT = HEIGHT - SAFE.top - SAFE.bottom
