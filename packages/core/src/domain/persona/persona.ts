import type { Failure } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'
import type { ProductBrief } from '../analysis/product-brief'

/** Where a persona watches short videos. Decides the format and the tone of theirs. */
export const CHANNELS = ['tiktok', 'instagram', 'youtube', 'linkedin'] as const
export type Channel = (typeof CHANNELS)[number]

/**
 * One typical user of the product, described so that a video can be written for them:
 * what hurts, what they want, what holds them back, and the words they use.
 */
export interface Persona {
  /** First name, to make the persona easy to talk about. */
  readonly name: string
  /** Who they are, in a few words: "Gérante de brasserie". */
  readonly role: string
  /** The audience of the brief this persona embodies. */
  readonly audience: string
  /** Their situation today, in one or two sentences. */
  readonly situation: string
  /** What frustrates them, in their own words. */
  readonly pains: readonly string[]
  /** What they are hoping for. */
  readonly goal: string
  /** What could keep them from trying the product. */
  readonly objections: readonly string[]
  /** Names of the brief's features that matter most to them. */
  readonly keyFeatures: readonly string[]
  /** Words and expressions they use, to write in their voice. */
  readonly vocabulary: readonly string[]
  /** The first line of their video: it must stop them scrolling in under two seconds. */
  readonly hook: string
  readonly channels: readonly Channel[]
  /**
   * Why this persona exists: how they follow from their audience and from the features of the
   * brief that inspired them. Null for personas written before it was asked for.
   */
  readonly rationale: string | null
}

/** Untrusted input, typically produced by an LLM. */
export type PersonaDraft = Omit<Persona, 'channels' | 'rationale'> & {
  readonly channels: readonly string[]
  readonly rationale: string
}

export interface InvalidPersonas extends Failure<'InvalidPersonas'> {
  readonly violations: readonly string[]
}

export const PERSONA_RULES = {
  minPersonas: 2,
  maxPersonas: 5,
  /** A hook is read in under two seconds: about twelve words. */
  maxHookLength: 80,
  maxPains: 4,
  maxObjections: 3,
  maxKeyFeatures: 3,
  /** One or two sentences. */
  maxRationaleLength: 320,
} as const

const isChannel = (value: string): value is Channel => (CHANNELS as readonly string[]).includes(value)

/**
 * The personas of one product. They only make sense together (distinct people, covering
 * different audiences) and against the brief they come from.
 */
export class Personas {
  private constructor(readonly all: readonly Persona[]) {}

  static create(drafts: readonly PersonaDraft[], brief: ProductBrief): Result<Personas, InvalidPersonas> {
    const violations: string[] = []
    const { minPersonas, maxPersonas, maxHookLength, maxPains, maxObjections, maxKeyFeatures, maxRationaleLength } = PERSONA_RULES

    if (drafts.length < minPersonas || drafts.length > maxPersonas) {
      violations.push(`Il faut entre ${minPersonas} et ${maxPersonas} personas, il y en a ${drafts.length}.`)
    }

    const names = drafts.map((draft) => draft.name.trim().toLowerCase())
    if (new Set(names).size !== names.length) violations.push('Deux personas portent le même prénom.')

    const featureNames = new Set(brief.props.features.map((feature) => feature.name))
    const personas = drafts.map((draft, index): Persona => {
      const at = `personas[${index}]`
      const required = (label: string, value: string) => {
        if (value.trim().length === 0) violations.push(`${at}.${label} est vide.`)
      }
      required('name', draft.name)
      required('role', draft.role)
      required('audience', draft.audience)
      required('situation', draft.situation)
      required('goal', draft.goal)
      required('hook', draft.hook)
      required('rationale', draft.rationale)

      if (draft.hook.length > maxHookLength) {
        violations.push(`${at}.hook dépasse ${maxHookLength} caractères (${draft.hook.length}).`)
      }
      if (draft.rationale.length > maxRationaleLength) {
        violations.push(`${at}.rationale dépasse ${maxRationaleLength} caractères (${draft.rationale.length}).`)
      }
      if (draft.pains.length === 0 || draft.pains.length > maxPains) {
        violations.push(`${at}.pains doit contenir entre 1 et ${maxPains} éléments.`)
      }
      if (draft.objections.length > maxObjections) violations.push(`${at}.objections dépasse ${maxObjections} éléments.`)
      if (draft.keyFeatures.length === 0 || draft.keyFeatures.length > maxKeyFeatures) {
        violations.push(`${at}.keyFeatures doit contenir entre 1 et ${maxKeyFeatures} éléments.`)
      }
      for (const feature of draft.keyFeatures) {
        if (!featureNames.has(feature)) {
          violations.push(`${at}.keyFeatures : « ${feature} » n'est pas une fonctionnalité du brief.`)
        }
      }

      const channels = draft.channels.filter(isChannel)
      if (channels.length === 0 || channels.length !== draft.channels.length) {
        violations.push(`${at}.channels doit contenir un ou plusieurs de : ${CHANNELS.join(', ')}.`)
      }

      return { ...draft, name: draft.name.trim(), hook: draft.hook.trim(), rationale: draft.rationale.trim(), channels }
    })

    if (violations.length > 0) {
      return err({ type: 'InvalidPersonas', message: 'Les personas sont incomplets ou incohérents.', violations })
    }
    return ok(new Personas(personas))
  }

  /** Rebuilds personas that were already validated (e.g. read back from disk). */
  static restore(personas: readonly Persona[]): Personas {
    // Files written before the rationale existed simply lack it.
    return new Personas(personas.map((persona) => ({ ...persona, rationale: persona.rationale ?? null })))
  }
}
