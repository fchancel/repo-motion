import type { Persona, ProductBrief, Result, Scene, SceneIcon, SceneVisual, StoryboardWriter, StoryboardWritingFailed, StoryboardWritingRequest } from '@repo-motion/core'
import { Storyboard, err } from '@repo-motion/core'
import { z } from 'zod'
import type { AnswerRejected, ClaudePromptRunner } from './claude-prompt-runner'
import { STORYBOARD_SYSTEM_PROMPT, storyboardPrompt, storyboardSchema } from './storyboard-prompt'

/**
 * Shape check of what Claude answered. Claude fills in the fixed structure of a short video;
 * the pacing rules (lengths, duration, features that exist…) are enforced by `Storyboard.create`.
 */
const answerSchema = z.object({
  hook: z.string(),
  pain: z.array(z.string()).default([]),
  reveal: z.string(),
  demo: z.string().optional(),
  features: z.array(
    z.object({
      feature: z.string(),
      icon: z.string(),
      visual: z.object({ type: z.string(), items: z.array(z.string()) }),
      title: z.string(),
      caption: z.string(),
    }),
  ),
  benefit: z.string(),
  cta: z.string(),
  post: z.object({ caption: z.string(), hashtags: z.array(z.string()) }),
})

/** The video's typefaces have no emoji: one that slipped in would render as an empty box. */
const clean = (text: string): string =>
  text
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

export const readStoryboard =
  (brief: ProductBrief, persona: Persona, options: { readonly demo: boolean } = { demo: false }) =>
  (answer: unknown): Result<Storyboard, AnswerRejected> => {
    if (answer === undefined || answer === null) return err({ problems: "La réponse ne contient pas d'objet JSON." })

    const parsed = answerSchema.safeParse(answer)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      return err({ problems: issues.slice(0, 8).join('\n') })
    }

    const { hook, pain, reveal, demo, features, benefit, cta, post } = parsed.data
    const scenes: Scene[] = [
      { kind: 'hook', text: clean(hook) },
      ...(pain.length > 0 ? [{ kind: 'pain', lines: pain.map(clean) } as const] : []),
      { kind: 'reveal', line: clean(reveal) },
      // The application is shown as soon as it is named.
      ...(options.demo && demo ? [{ kind: 'demo', caption: clean(demo) } as const] : []),
      ...features.map(
        (feature) =>
          ({
            kind: 'feature',
            feature: feature.feature,
            icon: feature.icon as SceneIcon,
            visual: { type: feature.visual.type as SceneVisual, items: feature.visual.items.map((item) => clean(item).replaceAll('*', '')) },
            title: clean(feature.title),
            caption: clean(feature.caption),
          }) as const,
      ),
      { kind: 'benefit', text: clean(benefit) },
      { kind: 'cta', text: clean(cta) },
    ]

    const storyboard = Storyboard.create(
      { scenes, post: { caption: post.caption.trim(), hashtags: post.hashtags.map((hashtag) => hashtag.trim()) } },
      persona,
      brief,
      options,
    )
    if (storyboard.ok) return storyboard

    // Claude answered with flat fields, not with scenes: point it back at what it wrote.
    return err({
      problems: `${storyboard.error.violations.join('\n')}\n\n(The scenes are, in order: ${scenes.map((scene, index) => `scenes[${index}] = ${scene.kind}`).join(', ')}.)`,
    })
  }

const TIMEOUT_MS = 5 * 60_000

/** Has the user's Claude Code fit the chosen script into the ready-made shots of one persona's video. */
export class ClaudeCodeStoryboardWriter implements StoryboardWriter {
  constructor(private readonly claude: ClaudePromptRunner) {}

  async write(request: StoryboardWritingRequest): Promise<Result<Storyboard, StoryboardWritingFailed>> {
    const { direction } = request
    const storyboard = await this.claude.askFor(
      {
        prompt: storyboardPrompt(request.brief, request.persona, direction, request.screens, request.script),
        systemPrompt: STORYBOARD_SYSTEM_PROMPT,
        schema: storyboardSchema(direction),
        // No tools at all: everything needed is in the prompt.
        tools: '',
        cwd: request.folder.path,
        timeoutMs: TIMEOUT_MS,
      },
      readStoryboard(request.brief, request.persona, { demo: direction.showsDemo }),
    )

    return storyboard.ok ? storyboard : err({ type: 'StoryboardWritingFailed', ...storyboard.error })
  }
}
