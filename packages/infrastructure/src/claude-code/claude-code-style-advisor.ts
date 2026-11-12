import type { Look, PersonaStyleSuggestion, Personas, ProductBrief, Result, StyleAdvisor, StyleSuggestionFailed, StyleSuggestionRequest, Tone } from '@repo-motion/core'
import { createVideoStyle, err, LOOKS, ok, TONES } from '@repo-motion/core'
import { z } from 'zod'
import type { AnswerRejected, ClaudePromptRunner } from './claude-prompt-runner'

/** What each look is, for the one who chooses among them. */
const LOOK_GUIDE: Record<Look, string> = {
  brand: 'the product’s own colours on a dark, softly lit stage. Faithful to the brand, fits anyone.',
  impact: 'flat blocks of the brand’s colours, capitals, hard cuts. Loud and energetic.',
  minimal: 'ink on paper, calm moves, lots of air. Clear and quiet.',
  neon: 'glowing tubes of light on black. Night, gaming, music, competition.',
  gradient: 'the brand’s colours melting into each other. Fresh, modern, optimistic.',
  editorial: 'a magazine page: serif type, italics, thin rules. Cultured, refined, adult.',
  terminal: 'a command line, text typed out in a monospace face. Developers and technical people.',
  pop: 'pastel blocks, stickers, thick outlines, bouncy moves. Young, playful, social.',
  cinema: 'black bars, wide capitals, slow dissolves. Dramatic, serious, storytelling.',
  retro: 'a vintage poster: sun rays, capitals with hard shadows. Warm, nostalgic, fun.',
  collage: 'a whimsical hand-made collage: cut-out paper, hand-drawn lines, tape and scribbles. Warm, human, charming.',
}

/** What each tone is, in a few words. How to write in it is the storyboard writer's business. */
const TONE_GUIDE: Record<Tone, string> = {
  brand: 'the product’s own voice',
  friendly: 'a friend sharing a good find',
  expert: 'calm, precise, one fact per line',
  funny: 'an absurd but true observation, and a punchline',
  pushy: 'direct, urgent, imperative',
  story: 'one small story in the present tense',
  pov: 'from inside the persona’s head ("POV: ...")',
  provocative: 'contradicts a received idea and holds the position',
  dare: 'challenges the viewer and doubts they can do it',
  inspiring: 'speaks to who the persona wants to become',
  teacher: 'teaches one thing; the product applies it',
  reassuring: 'calm and kind, removes objections one by one',
  sober: 'as few words as possible, plainly said',
  premium: 'assured, restrained, elegant',
  ironic: 'deadpan, says the opposite until the product appears',
  genz: 'the way people in their early twenties post',
  trailer: 'solemn and oversized on purpose, like a film trailer',
}

/** Claude never proposes the user's own music: it does not know whether they have any. */
const SUGGESTED_SOUNDS = ['none', 'effects', 'beat'] as const

const SYSTEM_PROMPT = `You are the art director of short-form video campaigns (TikTok, Reels, Shorts) for software products.

A product has several personas, and each gets a video written for them. For each persona, you choose how their video looks, speaks and sounds.

How to choose:
- Choose for the person: their age and world, where they watch short videos, the words they use, what makes them stop scrolling. A look and a tone that suit them is what makes the video feel made for them.
- Stay believable for the product: its category and its brand voice set limits. A sober tool for accountants does not shout in neon.
- The videos are posted as a series by the same product. Give the personas different looks and different tones wherever the personas really differ; two personas only share a choice when nothing else would suit one of them.
- "brand" (look or tone) is the safe choice, not the default: pick it when the product's own identity is exactly what speaks to that persona.
- Sound: "beat" for videos that should feel energetic, "effects" for a lighter touch, "none" when the persona mostly watches with the sound off (LinkedIn) or when silence suits the look.
- "reason" is one sentence, at most 120 characters, in the language of the brief, said to the product's owner: why this suits that persona.

Work from what you are given. Do not read or run anything.`

const prompt = (brief: ProductBrief, personas: Personas): string => `Here is the product:

${JSON.stringify({ name: brief.props.productName, category: brief.props.category, summary: brief.props.summary, voice: brief.props.brand.voice }, null, 2)}

Here are its personas:

${JSON.stringify(
  personas.all.map(({ name, role, situation, goal, vocabulary, channels }) => ({ name, role, situation, goal, vocabulary, channels })),
  null,
  2,
)}

The looks:
${LOOKS.map((look) => `- "${look}": ${LOOK_GUIDE[look]}`).join('\n')}

The tones:
${TONES.map((tone) => `- "${tone}": ${TONE_GUIDE[tone]}`).join('\n')}

Return one style per persona, with "persona" copied exactly from the persona's name.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['styles'],
  properties: {
    styles: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['persona', 'look', 'tone', 'sound', 'reason'],
        properties: {
          persona: { type: 'string', minLength: 1 },
          look: { enum: [...LOOKS] },
          tone: { enum: [...TONES] },
          sound: { enum: [...SUGGESTED_SOUNDS] },
          reason: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
  },
} as const

const answerSchema = z.object({
  styles: z.array(z.object({ persona: z.string(), look: z.string(), tone: z.string(), sound: z.string(), reason: z.string() })),
})

/** One valid style per persona of the project, or what Claude must fix. */
export const readStyles =
  (personas: Personas) =>
  (answer: unknown): Result<PersonaStyleSuggestion[], AnswerRejected> => {
    const parsed = answerSchema.safeParse(answer)
    if (!parsed.success) return err({ problems: 'The answer must be an object with a "styles" array of { persona, look, tone, sound, reason }.' })

    const problems: string[] = []
    const suggestions: PersonaStyleSuggestion[] = []
    for (const { name } of personas.all) {
      const proposed = parsed.data.styles.find((style) => style.persona.trim() === name)
      if (!proposed) {
        problems.push(`There is no style for the persona "${name}".`)
        continue
      }
      const style = createVideoStyle(proposed)
      if (!style.ok) problems.push(`${name}: ${style.error.violations.join(' ')}`)
      else if (style.value.sound === 'track') problems.push(`${name}: "sound" must be one of ${SUGGESTED_SOUNDS.join(', ')}.`)
      else suggestions.push({ persona: name, ...style.value, reason: proposed.reason.trim().slice(0, 160) })
    }
    return problems.length > 0 ? err({ problems: problems.join('\n') }) : ok(suggestions)
  }

const TIMEOUT_MS = 4 * 60_000

/** Has the user's Claude Code propose a look, a tone and a sound for each persona's video. */
export class ClaudeCodeStyleAdvisor implements StyleAdvisor {
  constructor(private readonly claude: ClaudePromptRunner) {}

  async suggest(request: StyleSuggestionRequest): Promise<Result<PersonaStyleSuggestion[], StyleSuggestionFailed>> {
    const styles = await this.claude.askFor(
      {
        prompt: prompt(request.brief, request.personas),
        systemPrompt: SYSTEM_PROMPT,
        schema: SCHEMA,
        // No tools at all: the brief and the personas are in the prompt.
        tools: '',
        cwd: request.folder.path,
        timeoutMs: TIMEOUT_MS,
      },
      readStyles(request.personas),
    )
    return styles.ok ? styles : err({ type: 'StyleSuggestionFailed', ...styles.error })
  }
}
