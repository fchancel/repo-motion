import type { Failure } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'
import { parseHexColor, type HexColor } from './hex-color'

export type FeatureImportance = 'core' | 'secondary'

export interface Feature {
  readonly name: string
  readonly description: string
  /** What the end user gains, in their words — the raw material for video hooks. */
  readonly userBenefit: string
  readonly importance: FeatureImportance
}

export interface UserJourney {
  readonly name: string
  readonly steps: readonly string[]
}

export interface BrandIdentity {
  readonly colors: {
    readonly primary: HexColor
    readonly secondary: HexColor | null
    readonly accent: HexColor | null
    readonly background: HexColor | null
    readonly text: HexColor | null
  }
  readonly fonts: readonly string[]
  /** Path of the logo inside the repository, when one was found. */
  readonly logoPath: string | null
  /** How the product talks to its users (formal, playful, technical…). */
  readonly voice: string
}

export interface ProductBriefProps {
  readonly productName: string
  readonly tagline: string
  readonly summary: string
  readonly problem: string
  readonly category: string
  readonly audiences: readonly string[]
  readonly features: readonly Feature[]
  readonly userJourneys: readonly UserJourney[]
  readonly brand: BrandIdentity
  /** Files that back the analysis, so the user can check where conclusions come from. */
  readonly evidence: readonly string[]
}

/** Untrusted input, typically produced by an LLM. Colours are still raw strings. */
export type ProductBriefDraft = Omit<ProductBriefProps, 'brand'> & {
  readonly brand: Omit<BrandIdentity, 'colors'> & {
    readonly colors: {
      readonly primary: string
      readonly secondary?: string | null
      readonly accent?: string | null
      readonly background?: string | null
      readonly text?: string | null
    }
  }
}

export interface InvalidProductBrief extends Failure<'InvalidProductBrief'> {
  readonly violations: readonly string[]
}

export const PRODUCT_BRIEF_RULES = {
  maxTaglineLength: 120,
  minFeatures: 1,
  maxFeatures: 12,
  maxAudiences: 6,
} as const

/** What the product is, for whom, and how it looks — everything later steps need to write personas and videos. */
export class ProductBrief {
  private constructor(readonly props: ProductBriefProps) {}

  static create(draft: ProductBriefDraft): Result<ProductBrief, InvalidProductBrief> {
    const violations: string[] = []
    const required = (label: string, value: string) => {
      if (value.trim().length === 0) violations.push(`${label} est vide.`)
    }

    required('productName', draft.productName)
    required('tagline', draft.tagline)
    required('summary', draft.summary)
    required('problem', draft.problem)
    required('category', draft.category)
    required('brand.voice', draft.brand.voice)

    if (draft.tagline.length > PRODUCT_BRIEF_RULES.maxTaglineLength) {
      violations.push(`tagline dépasse ${PRODUCT_BRIEF_RULES.maxTaglineLength} caractères.`)
    }
    if (draft.audiences.length === 0 || draft.audiences.length > PRODUCT_BRIEF_RULES.maxAudiences) {
      violations.push(`audiences doit contenir entre 1 et ${PRODUCT_BRIEF_RULES.maxAudiences} éléments.`)
    }
    const { minFeatures, maxFeatures } = PRODUCT_BRIEF_RULES
    if (draft.features.length < minFeatures || draft.features.length > maxFeatures) {
      violations.push(`features doit contenir entre ${minFeatures} et ${maxFeatures} éléments.`)
    }
    if (!draft.features.some((feature) => feature.importance === 'core')) {
      violations.push('Au moins une feature doit être marquée "core".')
    }
    draft.userJourneys.forEach((journey, index) => {
      if (journey.steps.length === 0) violations.push(`userJourneys[${index}] n'a aucune étape.`)
    })

    const colors = draft.brand.colors
    const primary = parseHexColor(colors.primary)
    if (!primary) violations.push(`brand.colors.primary « ${colors.primary} » n'est pas une couleur hexadécimale.`)

    const optional = (name: string, value: string | null | undefined): HexColor | null => {
      if (value === null || value === undefined || value === '') return null
      const parsed = parseHexColor(value)
      if (!parsed) violations.push(`brand.colors.${name} « ${value} » n'est pas une couleur hexadécimale.`)
      return parsed
    }
    const palette = {
      secondary: optional('secondary', colors.secondary),
      accent: optional('accent', colors.accent),
      background: optional('background', colors.background),
      text: optional('text', colors.text),
    }

    if (violations.length > 0 || !primary) {
      return err({ type: 'InvalidProductBrief', message: 'Le brief produit est incomplet ou incohérent.', violations })
    }

    return ok(
      new ProductBrief({
        ...draft,
        productName: draft.productName.trim(),
        tagline: draft.tagline.trim(),
        brand: { ...draft.brand, colors: { primary, ...palette } },
      }),
    )
  }

  /** Rebuilds a brief that was already validated (e.g. read back from the database). */
  static restore(props: ProductBriefProps): ProductBrief {
    return new ProductBrief(props)
  }

  get coreFeatures(): readonly Feature[] {
    return this.props.features.filter((feature) => feature.importance === 'core')
  }
}
