import type { PersonaWriter, PersonaWritingFailed, PersonaWritingRequest, ProductBrief, Result } from '@repo-motion/core'
import { Personas, err } from '@repo-motion/core'
import { z } from 'zod'
import type { AnswerRejected, ClaudePromptRunner } from './claude-prompt-runner'
import { PERSONAS_SCHEMA, PERSONAS_SYSTEM_PROMPT, personasPrompt } from './personas-prompt'

/**
 * Shape check of what Claude answered. Business rules (how many, hook length, features
 * that exist in the brief…) are enforced afterwards by `Personas.create`.
 */
const answerSchema = z.object({
  personas: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      audience: z.string(),
      situation: z.string(),
      pains: z.array(z.string()),
      goal: z.string(),
      objections: z.array(z.string()).default([]),
      keyFeatures: z.array(z.string()),
      vocabulary: z.array(z.string()).default([]),
      hook: z.string(),
      channels: z.array(z.string()),
      rationale: z.string(),
    }),
  ),
})

export const readPersonas =
  (brief: ProductBrief) =>
  (answer: unknown): Result<Personas, AnswerRejected> => {
    if (answer === undefined || answer === null) return err({ problems: "La réponse ne contient pas d'objet JSON." })

    const parsed = answerSchema.safeParse(answer)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      return err({ problems: issues.slice(0, 8).join('\n') })
    }

    const personas = Personas.create(parsed.data.personas, brief)
    return personas.ok ? personas : err({ problems: personas.error.violations.join('\n') })
  }

const TIMEOUT_MS = 5 * 60_000

/** Has the user's Claude Code imagine the product's personas, from the brief alone. */
export class ClaudeCodePersonaWriter implements PersonaWriter {
  constructor(private readonly claude: ClaudePromptRunner) {}

  async write(request: PersonaWritingRequest): Promise<Result<Personas, PersonaWritingFailed>> {
    const personas = await this.claude.askFor(
      {
        prompt: personasPrompt(request.brief),
        systemPrompt: PERSONAS_SYSTEM_PROMPT,
        schema: PERSONAS_SCHEMA,
        // No tools at all: the brief is in the prompt, the code is not needed.
        tools: '',
        cwd: request.folder.path,
        timeoutMs: TIMEOUT_MS,
      },
      readPersonas(request.brief),
    )

    return personas.ok ? personas : err({ type: 'PersonaWritingFailed', ...personas.error })
  }
}
