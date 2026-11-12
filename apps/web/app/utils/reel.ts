import type { ProductBriefDto } from '#shared/types/api'

/** The script of one short video: hook, demo, benefit, call to action. */
export interface Reel {
  brand: string
  /** Background colour of the video: the persona's hue, or the product's brand colour. */
  color: string
  hook: string
  demoTitle: string
  /** Three short labels shown in the app mock-up. */
  demoRows: string[]
  /** Subtitle spoken over the demo. */
  caption: string
  benefit: string
  cta: string
}

export const REEL_SCENES = [
  { key: 'hook', ms: 2600 },
  { key: 'demo', ms: 4000 },
  { key: 'benefit', ms: 2600 },
  { key: 'cta', ms: 2200 },
] as const

export type ReelSceneKey = (typeof REEL_SCENES)[number]['key']

const clip = (text: string, max: number): string => {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 12))}…`
}

/** A storyboard mock-up built from a real brief: what the first video could say. */
export const reelFromBrief = (brief: ProductBriefDto): Reel => {
  const core = brief.features.filter((feature) => feature.importance === 'core')
  const lead = core[0] ?? brief.features[0]

  return {
    brand: brief.productName,
    color: brief.brand.colors.primary,
    hook: clip(lead?.userBenefit ?? brief.tagline, 64),
    demoTitle: brief.productName,
    demoRows: brief.features.slice(0, 3).map((feature) => clip(feature.name, 24)),
    caption: clip(lead?.description ?? brief.summary, 60),
    benefit: clip(brief.tagline, 80),
    cta: `Essayer ${clip(brief.productName, 18)}`,
  }
}

/** Font size (in `cqi`) that lets a line of this length fill the frame without overflowing. */
export const fitText = (text: string, sizes: [short: number, medium: number, long: number]): string => {
  const [short, medium, long] = sizes
  return `${text.length > 52 ? long : text.length > 28 ? medium : short}cqi`
}
