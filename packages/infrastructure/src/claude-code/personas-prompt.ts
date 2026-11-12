import { CHANNELS, PERSONA_RULES, type ProductBrief } from '@repo-motion/core'

/** What Claude is asked to do with a brief, and the shape of its answer. */

export const PERSONAS_SYSTEM_PROMPT = `You are a senior marketing strategist who writes short-form video campaigns.

You are given the brief of a software product. Imagine the people most likely to love it, as concrete personas a video writer can write for: one specific person each, not a segment.

Rules:
- Each persona embodies one audience of the brief. Pick the audiences that differ most from one another, so their videos will differ too.
- Write "pains", "goal", "objections" and "hook" in the persona's own voice, with the words they would actually use.
- "situation" names one concrete moment of their week where the product would matter: a place, a time, what they are doing. Video writers build on that moment.
- "hook" is an idea of a first line for their video: it names that moment, their pain or their desire, so precisely that they would stop scrolling. It must also make sense to someone outside their niche: no jargon, no abbreviation, nothing that needs the product to be understood. No product name, no generic promise.
- "keyFeatures" must be copied exactly from the names of the brief's features.
- "rationale" explains the persona to the person reading the campaign, not to the persona: in the third person, name the audience of the brief they come from and the features of the brief that inspired them, and say why those features matter to this person.
- Do not invent facts about the product: everything you say it does must be in the brief.
- Write in the language of the brief.
- Work from the brief alone. Do not read or run anything.`

export const personasPrompt = (brief: ProductBrief): string => {
  const { minPersonas, maxPersonas, maxHookLength, maxPains, maxObjections, maxKeyFeatures, maxRationaleLength } = PERSONA_RULES
  return `Here is the product brief:

${JSON.stringify(brief.props, null, 2)}

Write between ${minPersonas} and ${maxPersonas} personas for this product (3 or 4 is usually right).

- "name": a first name, different for each persona.
- "role": who they are, in a few words.
- "audience": the audience of the brief they embody, copied from the brief.
- "situation": their situation today, in one or two sentences.
- "pains": 1 to ${maxPains} frustrations, in the first person.
- "goal": what they are hoping for, in the first person.
- "objections": up to ${maxObjections} reasons they might not try the product.
- "keyFeatures": 1 to ${maxKeyFeatures} feature names from the brief, the ones that matter most to them.
- "vocabulary": a few words and expressions they use.
- "hook": at most ${maxHookLength} characters.
- "channels": where they watch short videos, among ${CHANNELS.join(', ')}.
- "rationale": why this persona, in one or two sentences (at most ${maxRationaleLength} characters): the audience and the features of the brief that led to them.`
}

const text = { type: 'string', minLength: 1 } as const
const texts = (minItems: number, maxItems?: number) =>
  ({ type: 'array', items: text, minItems, ...(maxItems === undefined ? {} : { maxItems }) }) as const

/** JSON Schema given to Claude Code: it validates the answer before handing it back. */
export const PERSONAS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['personas'],
  properties: {
    personas: {
      type: 'array',
      minItems: PERSONA_RULES.minPersonas,
      maxItems: PERSONA_RULES.maxPersonas,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'role', 'audience', 'situation', 'pains', 'goal', 'objections', 'keyFeatures', 'vocabulary', 'hook', 'channels', 'rationale'],
        properties: {
          name: text,
          role: text,
          audience: text,
          situation: text,
          pains: texts(1, PERSONA_RULES.maxPains),
          goal: text,
          objections: texts(0, PERSONA_RULES.maxObjections),
          keyFeatures: texts(1, PERSONA_RULES.maxKeyFeatures),
          vocabulary: texts(0),
          hook: { type: 'string', minLength: 1, maxLength: PERSONA_RULES.maxHookLength },
          channels: { type: 'array', items: { enum: [...CHANNELS] }, minItems: 1 },
          rationale: { type: 'string', minLength: 1, maxLength: PERSONA_RULES.maxRationaleLength },
        },
      },
    },
  },
} as const
