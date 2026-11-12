import type { Failure } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'

/** The art direction: how the video looks and moves. `brand` is the product's own colours on a lit stage. */
export const LOOKS = ['brand', 'impact', 'minimal', 'neon', 'gradient', 'editorial', 'terminal', 'pop', 'cinema', 'retro', 'collage'] as const
export type Look = (typeof LOOKS)[number]

/** The voice the video is written in. `brand` keeps the product's own. */
export const TONES = [
  'brand', 'friendly', 'expert', 'funny', 'pushy', 'story', 'pov', 'provocative', 'dare', 'inspiring',
  'teacher', 'reassuring', 'sober', 'premium', 'ironic', 'genz', 'trailer',
] as const // prettier-ignore
export type Tone = (typeof TONES)[number]

/**
 * What is heard. `effects`: sounds on what moves. `beat`: a generated rhythm under them.
 * `track`: the user's own music file under them.
 */
export const SOUNDS = ['none', 'effects', 'beat', 'track'] as const
export type Sound = (typeof SOUNDS)[number]

/**
 * Whether the video shows the real application, and who chooses what is shown.
 * `auto`: Claude reads the code and picks the pages. `pages`: the user lists them.
 * Either way the application must be running, since it is filmed live.
 */
export const DEMO_MODES = ['none', 'auto', 'pages'] as const
export type DemoMode = (typeof DEMO_MODES)[number]

export interface DemoChoice {
  readonly mode: DemoMode
  /** `auto`: the one address where the application runs. `pages`: the pages to film, in order. `none`: empty. */
  readonly addresses: readonly string[]
}

/** How one persona's video looks, speaks and sounds. */
export interface VideoStyle {
  readonly look: Look
  readonly tone: Tone
  readonly sound: Sound
}

/** Untrusted input: typed in a form, or proposed by a model. */
export interface VideoStyleDraft {
  readonly look: string
  readonly tone: string
  readonly sound: string
}

export interface InvalidVideoStyle extends Failure<'InvalidVideoStyle'> {
  readonly violations: readonly string[]
}

/** With no choice made, a video looks like the brand, speaks like it, and is silent. */
export const DEFAULT_STYLE: VideoStyle = { look: 'brand', tone: 'brand', sound: 'none' }

/** A style Claude proposes for a persona, with why it suits them. */
export interface StyleSuggestion extends VideoStyle {
  readonly reason: string
}

/**
 * The style of one persona's videos: what Claude proposed, and what the user chose
 * instead, if they did. The choice wins; without either, the default applies.
 */
export interface PersonaStyle {
  readonly persona: string
  readonly suggestion: StyleSuggestion | null
  readonly choice: VideoStyle | null
}

const includes = <Value extends string>(values: readonly Value[], value: string): value is Value =>
  (values as readonly string[]).includes(value)

/** A web page a browser can open: the demo is filmed from the application as it runs. */
const webAddress = (address: string): URL | null => {
  const url = URL.parse(address)
  return url !== null && (url.protocol === 'http:' || url.protocol === 'https:') ? url : null
}

/**
 * The pages Claude picked, as addresses of the running application. Whatever was proposed,
 * nothing outside the application is ever filmed, and never more than a video can show.
 */
export const demoPagesOn = (address: string, paths: readonly string[]): string[] => {
  const base = webAddress(address)
  if (!base) return []
  const pages = paths.flatMap((path) => {
    const page = URL.parse(path, base.href)
    return page && page.origin === base.origin ? [page.href] : []
  })
  return [...new Set(pages)].slice(0, VIDEO_SETUP_RULES.maxDemoPages)
}

export const createVideoStyle = (draft: VideoStyleDraft): Result<VideoStyle, InvalidVideoStyle> => {
  const { look, tone, sound } = draft
  if (includes(LOOKS, look) && includes(TONES, tone) && includes(SOUNDS, sound)) return ok({ look, tone, sound })

  const violations = [
    ...(includes(LOOKS, look) ? [] : [`« ${look} » n'est pas une direction artistique connue.`]),
    ...(includes(TONES, tone) ? [] : [`« ${tone} » n'est pas un ton connu.`]),
    ...(includes(SOUNDS, sound) ? [] : [`« ${sound} » n'est pas un choix de son connu.`]),
  ]
  return err({ type: 'InvalidVideoStyle', message: "Ce style n'est pas valide.", violations })
}

/**
 * How a video is made. `directed`: Claude directs it from scratch, writing its animation
 * and looking at its own frames; it takes a while. `template`: Claude only writes the
 * words, and the video is assembled from ready-made shots; it takes a minute.
 */
export const PRODUCTIONS = ['directed', 'template'] as const
export type Production = (typeof PRODUCTIONS)[number]

export interface VideoSetupProps {
  readonly production: Production
  readonly demo: DemoChoice
  /** The user's own audio file, for the personas whose sound is `track`. */
  readonly track: string | null
}

/** Untrusted input, typically typed in a form. */
export interface VideoSetupDraft {
  readonly production: string
  readonly demo: { readonly mode: string; readonly addresses: readonly string[] }
  readonly track: string | null
}

export interface InvalidVideoSetup extends Failure<'InvalidVideoSetup'> {
  readonly violations: readonly string[]
}

export const VIDEO_SETUP_RULES = { maxDemoPages: 3 } as const

const NO_DEMO: DemoChoice = { mode: 'none', addresses: [] }

/**
 * What all the videos of a project share, because it belongs to the product and not to
 * a persona: where the application runs, and the user's own music.
 */
export class VideoSetup {
  private constructor(readonly props: VideoSetupProps) {}

  static default(): VideoSetup {
    return new VideoSetup({ production: 'directed', demo: NO_DEMO, track: null })
  }

  static create(draft: VideoSetupDraft): Result<VideoSetup, InvalidVideoSetup> {
    const violations: string[] = []
    const { production } = draft
    const mode = draft.demo.mode
    const addresses = [...new Set(draft.demo.addresses.map((address) => address.trim()).filter(Boolean))]

    if (!includes(PRODUCTIONS, production)) violations.push(`« ${production} » n'est pas une façon de fabriquer une vidéo.`)
    if (!includes(DEMO_MODES, mode)) violations.push(`« ${mode} » n'est pas une façon de montrer l'application.`)
    if (mode === 'auto' && addresses.length !== 1) violations.push("Indiquez l'adresse où tourne votre application (une seule).")
    if (mode === 'pages' && addresses.length === 0) violations.push('Indiquez au moins une page à montrer.')
    if (mode === 'pages' && addresses.length > VIDEO_SETUP_RULES.maxDemoPages) {
      violations.push(`La démo montre ${VIDEO_SETUP_RULES.maxDemoPages} pages au plus.`)
    }
    if (mode !== 'none') {
      for (const address of addresses) {
        if (!webAddress(address)) violations.push(`« ${address} » n'est pas une adresse web (ex. http://localhost:3000).`)
      }
    }

    if (violations.length > 0 || !includes(DEMO_MODES, mode) || !includes(PRODUCTIONS, production)) {
      return err({ type: 'InvalidVideoSetup', message: 'Ces réglages ne sont pas valides.', violations })
    }
    return ok(new VideoSetup({ production, demo: mode === 'none' ? NO_DEMO : { mode, addresses }, track: draft.track?.trim() || null }))
  }

  /** Rebuilds a setup that was already validated (e.g. read back from disk). */
  static restore(props: VideoSetupProps): VideoSetup {
    return new VideoSetup(props)
  }

  /** The same setup, with the track replaced by where the file really is. */
  withTrack(track: string): VideoSetup {
    return new VideoSetup({ ...this.props, track })
  }
}

export interface VideoDirectionProps extends VideoStyle, VideoSetupProps {}

/**
 * Everything one video is made with: its persona's style, and what the project's videos
 * share. Fixed when the video is asked for: later changes only apply to the next ones.
 */
export class VideoDirection {
  private constructor(readonly props: VideoDirectionProps) {}

  static default(): VideoDirection {
    return VideoDirection.of(DEFAULT_STYLE, VideoSetup.default())
  }

  static of(style: VideoStyle, setup: VideoSetup): VideoDirection {
    const { production, demo, track } = setup.props
    // Asking for one's own music without having given the file leaves the effects alone.
    const sound = style.sound === 'track' && !track ? 'effects' : style.sound
    return new VideoDirection({ look: style.look, tone: style.tone, sound, track: sound === 'track' ? track : null, demo, production })
  }

  /** Rebuilds a direction that was already validated (e.g. read back from disk). */
  static restore(props: VideoDirectionProps): VideoDirection {
    return new VideoDirection(props)
  }

  get showsDemo(): boolean {
    return this.props.demo.mode !== 'none'
  }
}

/** A page Claude proposes to film: where it is in the application, and what it shows. */
export interface DemoPage {
  readonly path: string
  readonly shows: string
}

/** A page of the running application, photographed for the demo. */
export interface AppScreen {
  readonly address: string
  /** The page's own title. */
  readonly title: string
  /** What the page shows, when Claude picked it from the code. Null when the user listed it. */
  readonly shows: string | null
  /** Where the picture is on this machine. */
  readonly file: string
}
