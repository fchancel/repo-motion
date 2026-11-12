import type { ChannelDto, PersonaDto, ProductBriefDto } from '#shared/types/api'
import type { Reel } from './reel'

/** One hue per persona, in order: their videos must be told apart at a glance. */
const HUES = ['#ff6b4a', '#7c8cff', '#3ee6a8', '#ff5caa', '#4ab8ff']

export const personaHue = (index: number): string => HUES[index % HUES.length] ?? '#7c8cff'

export const CHANNEL_LABELS: Record<ChannelDto, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
  youtube: 'YouTube Shorts',
  linkedin: 'LinkedIn',
}

const clip = (text: string, max: number): string => {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 12))}…`
}

/** A storyboard mock-up of the video this persona would get, in their own colour. */
export const reelFromPersona = (brief: ProductBriefDto, persona: PersonaDto, color: string): Reel => {
  const features = persona.keyFeatures.map((name) => brief.features.find((feature) => feature.name === name))
  const lead = features[0] ?? brief.features[0]
  // Their key features first, completed with the brief's so the mock-up always shows three rows.
  const rows = [...persona.keyFeatures, ...brief.features.map((feature) => feature.name)]

  return {
    brand: brief.productName,
    color,
    hook: persona.hook,
    demoTitle: brief.productName,
    demoRows: [...new Set(rows)].slice(0, 3).map((name) => clip(name, 24)),
    caption: clip(lead?.description ?? brief.summary, 60),
    benefit: clip(persona.goal, 80),
    cta: `Essayer ${clip(brief.productName, 18)}`,
  }
}
