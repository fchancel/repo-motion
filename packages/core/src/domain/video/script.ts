import type { Failure } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'
import type { ProductBrief } from '../analysis/product-brief'
import type { AppScreen, VideoDirection } from './direction'
import { plainText, type PostCopy } from './storyboard'

/**
 * The shapes a short video can take. The format is chosen for the product and the person:
 * a puzzle game is best played along, a tool is best shown at work, a habit is best mocked.
 */
export const SCRIPT_FORMATS = [
  /** The viewer plays a round in the video; the answer comes at the end. */
  'play-along',
  /** The product at work from the first second: "watch this". */
  'demo-first',
  /** The same moment without, then with the product. */
  'before-after',
  /** A belief the viewer holds, contradicted, then proven. */
  'myth',
  /** "POV:" the viewer's own situation, lived from the inside. */
  'pov',
  /** "3 things…", each one a beat. */
  'list',
  /** A pain the viewer feels, then the answer. */
  'problem-solution',
  /** A dare the viewer wants to take. */
  'challenge',
] as const
export type ScriptFormat = (typeof SCRIPT_FORMATS)[number]

/**
 * What each beat does for the viewer. A script must stop the scroll (`hook`), say early and
 * plainly what this is (`context`), keep giving reasons to stay (`tension`, `proof`, `rehook`),
 * answer the question it opened (`payoff`) and end on one thing to do (`cta`).
 */
export const BEAT_ROLES = ['hook', 'context', 'tension', 'proof', 'rehook', 'payoff', 'cta'] as const
export type BeatRole = (typeof BEAT_ROLES)[number]

export interface ScriptBeat {
  readonly role: BeatRole
  /** What is read on screen. May wrap the words that carry it in `*asterisks*`. Empty for a beat that is only seen. */
  readonly onScreen: string
  /** What is seen meanwhile: the real screens, an action, a result. */
  readonly visual: string
  readonly seconds: number
}

/**
 * What a viewer who knows nothing of the product made of the script, watching it as it
 * would play. Written by a second Claude, who is given the screen and nothing else.
 */
export interface ViewerTest {
  /** What they think the product is, in their own words. */
  readonly whatItIs: string
  /** What they would do with it. */
  readonly whatFor: string
  /** The second by which they understood what the video is about: the end of the beat that made it clear. Null: never. */
  readonly understoodAt: number | null
  /** The second at which they would have swiped away: the start of the beat they left on. Null: they watched to the end. */
  readonly leftAt: number | null
  /** Why they left, or what kept them. */
  readonly why: string
  /** Words or lines they did not understand. */
  readonly confusing: readonly string[]
  /** From 0 to 10. */
  readonly scores: { readonly hook: number; readonly clarity: number; readonly retention: number }
}

/**
 * `pass`: understood early and watched to the end. `fail`: never understood, or gone before
 * being told what it is. `weak`: somewhere in between.
 */
export type ViewerVerdict = 'pass' | 'weak' | 'fail'

export interface ScriptProps {
  readonly format: ScriptFormat
  /** Why this video works for this person, in a sentence. */
  readonly angle: string
  /** The question the first seconds open, which the `payoff` beat answers. Null when there is none. */
  readonly openLoop: string | null
  readonly beats: readonly ScriptBeat[]
  readonly post: PostCopy
  /** What a viewer made of it. Null until it was tested. */
  readonly test: ViewerTest | null
  /** True when the user changed its words after it was tested. */
  readonly edited: boolean
}

/** Untrusted input, typically produced by an LLM. */
export interface ScriptDraft {
  readonly format: string
  readonly angle: string
  readonly openLoop: string | null
  readonly beats: readonly { readonly role: string; readonly onScreen: string; readonly visual: string; readonly seconds: number }[]
  readonly post: PostCopy
}

export interface InvalidScript extends Failure<'InvalidScript'> {
  readonly violations: readonly string[]
}

/**
 * What a script must hold to keep a viewer and be understood by them. These are the rules
 * a machine can check; the viewer test judges the rest.
 */
export const SCRIPT_RULES = {
  minBeats: 4,
  maxBeats: 12,
  maxHookLength: 80,
  /** The hook decides in under three seconds. */
  maxHookSeconds: 3,
  /** By then, the viewer must have been told what this is. */
  maxContextStart: 6,
  maxBeatLength: 110,
  maxCtaLength: 40,
  minBeatSeconds: 0.8,
  maxBeatSeconds: 6,
  minSeconds: 12,
  maxSeconds: 40,
  maxAngleLength: 240,
  maxOpenLoopLength: 120,
  maxVisualLength: 240,
  maxPostCaptionLength: 180,
  minHashtags: 3,
  maxHashtags: 6,
} as const

/** Half a second to notice a text, a quarter of a second per word to read it. */
export const beatReadingSeconds = (text: string): number => {
  // French punctuation stands apart (« ville ? »): it is not a word to read.
  const words = plainText(text)
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length
  return words === 0 ? 0 : Math.round((0.5 + words * 0.25) * 10) / 10
}

const HASHTAG = /^#[\p{L}\p{N}_]{2,30}$/u

const includes = <Value extends string>(values: readonly Value[], value: string): value is Value => (values as readonly string[]).includes(value)

const round = (seconds: number): number => Math.round(seconds * 10) / 10

/** One way to tell a persona's video, beat by beat, with what was made of it by a viewer who knew nothing. */
export class Script {
  private constructor(readonly props: ScriptProps) {}

  static create(draft: ScriptDraft, brief: ProductBrief): Result<Script, InvalidScript> {
    const rules = SCRIPT_RULES
    const violations: string[] = []
    const { beats } = draft

    if (!includes(SCRIPT_FORMATS, draft.format)) violations.push(`format : « ${draft.format} » n'est pas un format connu.`)
    if (draft.angle.trim().length === 0 || draft.angle.length > rules.maxAngleLength) {
      violations.push(`angle doit faire entre 1 et ${rules.maxAngleLength} caractères.`)
    }
    if (draft.openLoop !== null && (draft.openLoop.trim().length === 0 || draft.openLoop.length > rules.maxOpenLoopLength)) {
      violations.push(`openLoop doit faire entre 1 et ${rules.maxOpenLoopLength} caractères, ou être null.`)
    }

    if (beats.length < rules.minBeats || beats.length > rules.maxBeats) {
      violations.push(`Il faut entre ${rules.minBeats} et ${rules.maxBeats} temps (il y en a ${beats.length}).`)
    }

    let at = 0
    let contextAt: number | null = null
    beats.forEach((beat, index) => {
      const label = `beats[${index}]`
      const text = plainText(beat.onScreen).trim()
      if (!includes(BEAT_ROLES, beat.role)) violations.push(`${label}.role : « ${beat.role} » n'est pas un rôle connu.`)
      if (text.length > rules.maxBeatLength) violations.push(`${label}.onScreen dépasse ${rules.maxBeatLength} caractères (${text.length}).`)
      if ((beat.onScreen.match(/\*/g)?.length ?? 0) % 2 !== 0) violations.push(`${label}.onScreen a un astérisque d'emphase non refermé.`)
      if (beat.visual.trim().length === 0 || beat.visual.length > rules.maxVisualLength) {
        violations.push(`${label}.visual doit dire ce qu'on voit, en ${rules.maxVisualLength} caractères au plus.`)
      }
      if (!(beat.seconds >= rules.minBeatSeconds && beat.seconds <= rules.maxBeatSeconds)) {
        violations.push(`${label}.seconds doit être entre ${rules.minBeatSeconds} et ${rules.maxBeatSeconds} s.`)
      } else if (beat.seconds + 0.05 < beatReadingSeconds(beat.onScreen)) {
        // A text taken away before it is read is a text lost: the viewer feels it and leaves.
        violations.push(`${label} : « ${text} » demande ${beatReadingSeconds(beat.onScreen)} s de lecture, il n'en a que ${beat.seconds}.`)
      }
      if (beat.role === 'context' && contextAt === null) contextAt = at
      at += beat.seconds > 0 ? beat.seconds : 0
    })

    const hook = beats[0]
    if (hook) {
      if (hook.role !== 'hook') violations.push('Le premier temps doit être « hook ».')
      const text = plainText(hook.onScreen).trim()
      if (text.length === 0) violations.push("L'accroche doit avoir un texte : sans son, c'est lui qui retient.")
      if (text.length > rules.maxHookLength) violations.push(`L'accroche dépasse ${rules.maxHookLength} caractères (${text.length}).`)
      if (hook.seconds > rules.maxHookSeconds) violations.push(`L'accroche dure ${hook.seconds} s : ${rules.maxHookSeconds} au plus.`)
      // Naming the product first turns the video into an ad people skip.
      if (text.toLowerCase().includes(brief.props.productName.toLowerCase())) violations.push("L'accroche ne doit pas contenir le nom du produit.")
    }
    if (beats.filter((beat) => beat.role === 'hook').length > 1) violations.push('Il faut une seule accroche.')

    if (contextAt === null) violations.push('Il manque un temps « context » : celui qui dit clairement de quoi il s\'agit.')
    else if (contextAt > rules.maxContextStart) {
      violations.push(`Le temps « context » commence à ${round(contextAt)} s : le spectateur doit savoir de quoi on parle avant ${rules.maxContextStart} s.`)
    }

    const cta = beats.at(-1)
    if (cta && cta.role !== 'cta') violations.push('Le dernier temps doit être « cta ».')
    if (cta && (plainText(cta.onScreen).trim().length === 0 || plainText(cta.onScreen).length > rules.maxCtaLength)) {
      violations.push(`L'appel à l'action doit faire entre 1 et ${rules.maxCtaLength} caractères.`)
    }

    // A question opened and never answered is a promise broken at the end of the video.
    if (draft.openLoop !== null && !beats.some((beat, index) => index > 0 && beat.role === 'payoff')) {
      violations.push('La question ouverte au début (openLoop) doit trouver sa réponse dans un temps « payoff ».')
    }

    const seconds = round(at)
    if (seconds < rules.minSeconds || seconds > rules.maxSeconds) {
      violations.push(`Le script dure ${seconds} s : il doit durer entre ${rules.minSeconds} et ${rules.maxSeconds} s.`)
    }

    const { post } = draft
    if (post.caption.trim().length === 0 || post.caption.length > rules.maxPostCaptionLength) {
      violations.push(`post.caption doit faire entre 1 et ${rules.maxPostCaptionLength} caractères.`)
    }
    if (post.hashtags.length < rules.minHashtags || post.hashtags.length > rules.maxHashtags) {
      violations.push(`post.hashtags doit contenir entre ${rules.minHashtags} et ${rules.maxHashtags} mots-dièse.`)
    }
    for (const hashtag of post.hashtags) {
      if (!HASHTAG.test(hashtag)) violations.push(`post.hashtags : « ${hashtag} » n'est pas un mot-dièse valide (ex. #quiz).`)
    }

    if (violations.length > 0 || !includes(SCRIPT_FORMATS, draft.format)) {
      return err({ type: 'InvalidScript', message: 'Ce script ne tient pas les règles du format court.', violations })
    }
    return ok(
      new Script({
        format: draft.format,
        angle: draft.angle.trim(),
        openLoop: draft.openLoop?.trim() ?? null,
        beats: beats.map((beat) => ({ role: beat.role as BeatRole, onScreen: beat.onScreen.trim(), visual: beat.visual.trim(), seconds: round(beat.seconds) })),
        post: { caption: post.caption.trim(), hashtags: post.hashtags.map((hashtag) => hashtag.trim()) },
        test: null,
        edited: false,
      }),
    )
  }

  /** Rebuilds a script that was already validated (e.g. read back from disk). */
  static restore(props: ScriptProps): Script {
    return new Script(props)
  }

  /** The same script, with what a viewer made of it. */
  tested(test: ViewerTest): Script {
    return new Script({ ...this.props, test, edited: false })
  }

  /**
   * The same script with the user's own words on screen, one text per beat. A beat whose
   * text grew stays on screen long enough to be read. The viewer test no longer matches it.
   */
  edit(texts: readonly string[], brief: ProductBrief): Result<Script, InvalidScript> {
    if (texts.length !== this.props.beats.length) {
      return err({ type: 'InvalidScript', message: 'Ce script a changé entre-temps.', violations: [`Il y a ${this.props.beats.length} textes à donner.`] })
    }
    const beats = this.props.beats.map((beat, index) => {
      const onScreen = texts[index]?.trim() ?? beat.onScreen
      return { ...beat, onScreen, seconds: Math.min(SCRIPT_RULES.maxBeatSeconds, Math.max(beat.seconds, beatReadingSeconds(onScreen))) }
    })
    if (beats.every((beat, index) => beat.onScreen === this.props.beats[index]?.onScreen)) return ok(this)

    const edited = Script.create({ ...this.props, beats }, brief)
    return edited.ok ? ok(new Script({ ...edited.value.props, test: this.props.test, edited: true })) : edited
  }

  get seconds(): number {
    return round(this.props.beats.reduce((total, beat) => total + beat.seconds, 0))
  }

  /** When each beat starts, in seconds. */
  get starts(): number[] {
    let at = 0
    return this.props.beats.map((beat) => {
      const start = round(at)
      at += beat.seconds
      return start
    })
  }

  get hook(): string {
    return this.props.beats[0]?.onScreen ?? ''
  }

  get verdict(): ViewerVerdict | null {
    return this.props.test ? viewerVerdict(this.props.test, this.contextStart, this.contextEnd) : null
  }

  /** When the video starts saying what it is. */
  get contextStart(): number {
    const index = this.props.beats.findIndex((beat) => beat.role === 'context')
    return index === -1 ? this.seconds : (this.starts[index] ?? 0)
  }

  /** When the video has said what it is: by then, the viewer should know. */
  get contextEnd(): number {
    const index = this.props.beats.findIndex((beat) => beat.role === 'context')
    const beat = this.props.beats[index]
    return beat ? round(this.contextStart + beat.seconds) : this.seconds
  }
}

/**
 * `pass`: understood by the end of the context beat, and watched to the end. `fail`: never
 * understood, or gone before being told what it is. `weak`: understood late, or left on the way.
 */
export const viewerVerdict = (test: ViewerTest, contextStart: number, contextEnd: number): ViewerVerdict => {
  if (test.understoodAt === null) return 'fail'
  if (test.leftAt !== null && test.leftAt <= Math.max(contextStart, 2)) return 'fail'
  if (test.leftAt === null && test.understoodAt <= contextEnd + 0.05) return 'pass'
  return 'weak'
}

const VERDICT_RANK: Record<ViewerVerdict, number> = { pass: 2, weak: 1, fail: 0 }

/** The better of two scripts for a viewer: the verdict first, then the scores. */
export const scriptStrength = (script: Script): number => {
  const test = script.props.test
  if (!test) return -1
  const { hook, clarity, retention } = test.scores
  return VERDICT_RANK[script.verdict ?? 'fail'] * 100 + hook + clarity + retention
}

export const SCRIPT_SET_RULES = { minCandidates: 1, maxCandidates: 4 } as const

export interface ScriptSetProps {
  /** The scripts offered to the user, in the order they were written. */
  readonly candidates: readonly Script[]
  /** The one the writers would make. */
  readonly recommended: number
  /** The direction the scripts were written for: their tone, whether they show the application. */
  readonly direction: VideoDirection
  /** The pages filmed before writing, which the scripts may show. */
  readonly screens: readonly AppScreen[]
  /** The script the user chose, as they chose it (possibly with their own words). Null until then. */
  readonly chosen: { readonly index: number; readonly script: Script } | null
  readonly writtenAt: Date
}

/**
 * The scripts written for one persona's video, among which the user picks the one to make.
 * Kept with the video: after it is made, another can be picked without writing them again.
 */
export class ScriptSet {
  private constructor(readonly props: ScriptSetProps) {}

  static of(props: Omit<ScriptSetProps, 'chosen'>): ScriptSet {
    const count = props.candidates.length
    const recommended = props.recommended >= 0 && props.recommended < count ? props.recommended : 0
    return new ScriptSet({ ...props, recommended, chosen: null })
  }

  static restore(props: ScriptSetProps): ScriptSet {
    return new ScriptSet(props)
  }

  /** The user's choice, with their own words on screen when they changed them. */
  choose(index: number, texts: readonly string[] | null, brief: ProductBrief): Result<ScriptSet, InvalidScript> {
    const candidate = this.props.candidates[index]
    if (!candidate) {
      return err({ type: 'InvalidScript', message: "Ce script n'existe pas.", violations: [`Il y a ${this.props.candidates.length} scripts.`] })
    }
    const script = texts ? candidate.edit(texts, brief) : ok(candidate)
    if (!script.ok) return script
    return ok(new ScriptSet({ ...this.props, chosen: { index, script: script.value } }))
  }
}
