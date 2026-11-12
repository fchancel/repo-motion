import type { Failure } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'
import type { ProductBrief } from '../analysis/product-brief'
import type { Persona } from '../persona/persona'

/** The pictograms a feature can be illustrated with. The video draws them; the storyboard only names one. */
export const SCENE_ICONS = [
  'bolt', 'target', 'clock', 'calendar', 'chart', 'users', 'lock', 'shield', 'sparkles', 'map-pin',
  'globe', 'trophy', 'heart', 'search', 'chat', 'bell', 'wallet', 'camera', 'code', 'gamepad',
  'book', 'gift', 'rocket', 'eye', 'share', 'star', 'music', 'cart', 'file', 'languages',
  'video', 'wand', 'check', 'coins', 'layers', 'mic', 'pen', 'image', 'flag', 'puzzle',
] as const // prettier-ignore

export type SceneIcon = (typeof SCENE_ICONS)[number]

/**
 * The small animated interfaces a feature can be shown with. Each one moves in its own
 * way; the storyboard picks the one that shows the feature, and gives it its words.
 */
export const SCENE_VISUALS = [
  'search', 'checklist', 'chart', 'counter', 'map', 'chat', 'leaderboard', 'timer', 'toggles', 'document', 'share', 'cards',
] as const // prettier-ignore

export type SceneVisual = (typeof SCENE_VISUALS)[number]

/** How many labels each interface needs at least to make sense. */
export const VISUAL_MIN_ITEMS: Record<SceneVisual, number> = {
  // What is typed, then at least one result.
  search: 2,
  checklist: 2,
  chart: 2,
  // The number that is counted up to.
  counter: 1,
  map: 0,
  chat: 2,
  leaderboard: 2,
  timer: 0,
  toggles: 2,
  document: 1,
  share: 0,
  cards: 2,
}

/** A feature shown as an interface in motion: which one, and the words written on it. */
export interface FeatureVisual {
  readonly type: SceneVisual
  readonly items: readonly string[]
}

/**
 * The shots of a short video, in the order they play. Texts may wrap words in
 * `*asterisks*` to mark the ones the video highlights, like karaoke captions.
 */
export type Scene =
  /** The first words: they name the persona's pain or desire, and must stop the scroll. */
  | { readonly kind: 'hook'; readonly text: string }
  /** What hurts today, in the persona's own words: one short line per beat. */
  | { readonly kind: 'pain'; readonly lines: readonly string[] }
  /** The product appears: its name is shown by the video, `line` says what it is. */
  | { readonly kind: 'reveal'; readonly line: string }
  /** The real application, filmed: its pages scroll in a phone while `caption` is read. */
  | { readonly kind: 'demo'; readonly caption: string }
  /** One feature that answers the pain. `feature` is its name in the brief. */
  | {
      readonly kind: 'feature'
      readonly feature: string
      readonly icon: SceneIcon
      readonly visual: FeatureVisual
      readonly title: string
      readonly caption: string
    }
  /** What the persona gains. */
  | { readonly kind: 'benefit'; readonly text: string }
  /** What to do now. */
  | { readonly kind: 'cta'; readonly text: string }

export type SceneKind = Scene['kind']

/** What to post with the video. */
export interface PostCopy {
  readonly caption: string
  readonly hashtags: readonly string[]
}

export interface StoryboardProps {
  readonly persona: string
  readonly scenes: readonly Scene[]
  readonly post: PostCopy
}

/** Untrusted input, typically produced by an LLM. */
export type StoryboardDraft = Omit<StoryboardProps, 'persona'>

export interface InvalidStoryboard extends Failure<'InvalidStoryboard'> {
  readonly violations: readonly string[]
}

/**
 * Pacing rules of short-form video. They live here, not in the prompt: the model
 * proposes a storyboard, the domain guarantees it can hold attention.
 */
export const STORYBOARD_RULES = {
  /** A hook is read in about two seconds. */
  maxHookLength: 80,
  maxPainLines: 3,
  maxLineLength: 46,
  maxRevealLength: 60,
  minFeatures: 1,
  maxFeatures: 3,
  maxFeatureTitleLength: 34,
  maxCaptionLength: 64,
  maxVisualItems: 4,
  maxVisualItemLength: 26,
  maxBenefitLength: 64,
  maxCtaLength: 26,
  minSeconds: 12,
  maxSeconds: 28,
  /** A demo is footage, not text: it may make the video this much longer. */
  demoExtraSeconds: 5,
  maxDemoCaptionLength: 60,
  maxPostCaptionLength: 180,
  minHashtags: 3,
  maxHashtags: 6,
} as const

/** The text as it is read, without the emphasis markers. */
export const plainText = (text: string): string => text.replaceAll('*', '')

/** Words appear one by one: this is how long each of them needs to be read. */
const SECONDS_PER_WORD = 0.22

const readingSeconds = (...texts: string[]): number =>
  texts.reduce((words, text) => words + plainText(text).split(/\s+/).filter(Boolean).length, 0) * SECONDS_PER_WORD

/**
 * How long each shot stays on screen, in seconds: long enough to be read, never longer.
 * A shot that drags is where people swipe away.
 */
export const sceneSeconds = (scene: Scene): number => {
  switch (scene.kind) {
    case 'hook':
      return Math.max(2.4, 1 + readingSeconds(scene.text))
    case 'pain':
      return 0.4 + scene.lines.reduce((total, line) => total + Math.max(1.1, 0.5 + readingSeconds(line)), 0)
    case 'reveal':
      // The product's name lands first, then the line is read.
      return Math.max(2.6, 1.4 + readingSeconds(scene.line))
    case 'demo':
      // Long enough to see the application scroll, whatever the caption.
      return Math.max(4, 2 + readingSeconds(scene.caption))
    case 'feature':
      return Math.max(3.2, 1.2 + readingSeconds(scene.title, scene.caption))
    case 'benefit':
      return Math.max(2.4, 1.1 + readingSeconds(scene.text))
    case 'cta':
      return 3
  }
}

const totalSeconds = (scenes: readonly Scene[]): number =>
  Math.round(scenes.reduce((total, scene) => total + sceneSeconds(scene), 0) * 10) / 10

const HASHTAG = /^#[\p{L}\p{N}_]{2,30}$/u

/** One persona's video, shot by shot, with what to post alongside it. */
export class Storyboard {
  private constructor(readonly props: StoryboardProps) {}

  /** `options.demo`: the video shows the real application, so it must have its demo shot. */
  static create(
    draft: StoryboardDraft,
    persona: Persona,
    brief: ProductBrief,
    options: { readonly demo: boolean } = { demo: false },
  ): Result<Storyboard, InvalidStoryboard> {
    const rules = STORYBOARD_RULES
    const violations: string[] = []
    const { scenes, post } = draft

    const checkText = (label: string, text: string, max: number) => {
      const plain = plainText(text).trim()
      if (plain.length === 0) violations.push(`${label} est vide.`)
      if (plain.length > max) violations.push(`${label} dépasse ${max} caractères (${plain.length}).`)
      if ((text.match(/\*/g)?.length ?? 0) % 2 !== 0) violations.push(`${label} a un astérisque d'emphase non refermé.`)
    }

    if (scenes[0]?.kind !== 'hook') violations.push('La première scène doit être « hook ».')
    if (scenes.at(-1)?.kind !== 'cta') violations.push('La dernière scène doit être « cta ».')

    const count = (kind: SceneKind) => scenes.filter((scene) => scene.kind === kind).length
    for (const kind of ['hook', 'reveal', 'cta'] as const) {
      if (count(kind) !== 1) violations.push(`Il faut exactement une scène « ${kind} » (il y en a ${count(kind)}).`)
    }
    if (count('pain') > 1 || count('benefit') > 1) violations.push('Au plus une scène « pain » et une scène « benefit ».')
    if (options.demo && count('demo') !== 1) violations.push(`Il faut exactement une scène « demo » (il y en a ${count('demo')}).`)
    if (!options.demo && count('demo') > 0) violations.push("Aucune scène « demo » : l'application n'est pas filmée.")
    if (count('feature') < rules.minFeatures || count('feature') > rules.maxFeatures) {
      violations.push(`Il faut entre ${rules.minFeatures} et ${rules.maxFeatures} scènes « feature ».`)
    }

    const revealAt = scenes.findIndex((scene) => scene.kind === 'reveal')
    const featureNames = new Set(brief.props.features.map((feature) => feature.name))

    scenes.forEach((scene, index) => {
      const at = `scenes[${index}]`
      switch (scene.kind) {
        case 'hook':
          checkText(`${at}.text`, scene.text, rules.maxHookLength)
          // Naming the product in the hook turns it into an ad people skip.
          if (plainText(scene.text).toLowerCase().includes(brief.props.productName.toLowerCase())) {
            violations.push(`${at}.text ne doit pas contenir le nom du produit.`)
          }
          break
        case 'pain':
          if (scene.lines.length === 0 || scene.lines.length > rules.maxPainLines) {
            violations.push(`${at}.lines doit contenir entre 1 et ${rules.maxPainLines} lignes.`)
          }
          scene.lines.forEach((line, i) => checkText(`${at}.lines[${i}]`, line, rules.maxLineLength))
          if (revealAt !== -1 && index > revealAt) violations.push(`${at} : la scène « pain » doit précéder « reveal ».`)
          break
        case 'reveal':
          checkText(`${at}.line`, scene.line, rules.maxRevealLength)
          break
        case 'demo':
          checkText(`${at}.caption`, scene.caption, rules.maxDemoCaptionLength)
          if (index < revealAt) violations.push(`${at} : la scène « demo » doit suivre « reveal ».`)
          break
        case 'feature':
          checkText(`${at}.title`, scene.title, rules.maxFeatureTitleLength)
          checkText(`${at}.caption`, scene.caption, rules.maxCaptionLength)
          if (!SCENE_ICONS.includes(scene.icon)) violations.push(`${at}.icon : « ${scene.icon} » n'est pas un pictogramme connu.`)
          if (!SCENE_VISUALS.includes(scene.visual.type)) {
            violations.push(`${at}.visual.type : « ${scene.visual.type} » n'est pas une interface connue.`)
          } else {
            const { type, items } = scene.visual
            if (items.length < VISUAL_MIN_ITEMS[type] || items.length > rules.maxVisualItems) {
              violations.push(`${at}.visual.items : « ${type} » demande entre ${VISUAL_MIN_ITEMS[type]} et ${rules.maxVisualItems} libellés.`)
            }
            items.forEach((item, i) => {
              if (item.trim().length === 0 || item.length > rules.maxVisualItemLength || item.includes('*')) {
                violations.push(`${at}.visual.items[${i}] doit faire entre 1 et ${rules.maxVisualItemLength} caractères, sans astérisque.`)
              }
            })
            // A counter counts up to a number: without one, there is nothing to count.
            if (type === 'counter' && !/\d/.test(items[0] ?? '')) violations.push(`${at}.visual.items[0] doit contenir le nombre affiché.`)
          }
          if (!featureNames.has(scene.feature)) {
            violations.push(`${at}.feature : « ${scene.feature} » n'est pas une fonctionnalité du brief.`)
          }
          if (index < revealAt) violations.push(`${at} : les scènes « feature » doivent suivre « reveal ».`)
          break
        case 'benefit':
          checkText(`${at}.text`, scene.text, rules.maxBenefitLength)
          break
        case 'cta':
          checkText(`${at}.text`, scene.text, rules.maxCtaLength)
          break
      }
    })

    const seconds = totalSeconds(scenes)
    if (seconds < rules.minSeconds) {
      violations.push(`La vidéo dure ${seconds.toFixed(1)} s : il en faut au moins ${rules.minSeconds}. Ajoutez une scène.`)
    }
    const longest = rules.maxSeconds + (options.demo ? rules.demoExtraSeconds : 0)
    if (seconds > longest) {
      violations.push(`La vidéo dure ${seconds.toFixed(1)} s : ${longest} au plus. Raccourcissez les textes ou retirez une scène.`)
    }

    if (post.caption.trim().length === 0 || post.caption.length > rules.maxPostCaptionLength) {
      violations.push(`post.caption doit faire entre 1 et ${rules.maxPostCaptionLength} caractères.`)
    }
    if (post.hashtags.length < rules.minHashtags || post.hashtags.length > rules.maxHashtags) {
      violations.push(`post.hashtags doit contenir entre ${rules.minHashtags} et ${rules.maxHashtags} mots-dièse.`)
    }
    for (const hashtag of post.hashtags) {
      if (!HASHTAG.test(hashtag)) violations.push(`post.hashtags : « ${hashtag} » n'est pas un mot-dièse valide (ex. #quiz).`)
    }

    if (violations.length > 0) {
      return err({ type: 'InvalidStoryboard', message: 'Le storyboard ne respecte pas les règles du format court.', violations })
    }
    return ok(new Storyboard({ persona: persona.name, scenes, post }))
  }

  /** Rebuilds a storyboard that was already validated (e.g. read back from disk). */
  static restore(props: StoryboardProps): Storyboard {
    // Storyboards written before features had an interface are shown with the plainest one.
    const scenes = props.scenes.map((scene) =>
      scene.kind === 'feature' && !(scene as { visual?: FeatureVisual }).visual ? { ...scene, visual: { type: 'cards', items: [] } as const } : scene,
    )
    return new Storyboard({ ...props, scenes })
  }

  get seconds(): number {
    return totalSeconds(this.props.scenes)
  }
}
