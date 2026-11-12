import { ProductBrief, err, type Result } from '@repo-motion/core'
import { z } from 'zod'
import type { AnswerRejected } from './claude-prompt-runner'

/**
 * Shape check of what Claude answered. Business rules (lengths, colours, core feature…)
 * are enforced afterwards by `ProductBrief.create`, so they live in exactly one place.
 */
const nullableString = z.string().nullish().transform((value) => value ?? null)

const documentSchema = z.object({
  productName: z.string(),
  tagline: z.string(),
  summary: z.string(),
  problem: z.string(),
  category: z.string(),
  audiences: z.array(z.string()),
  features: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      userBenefit: z.string(),
      importance: z.enum(['core', 'secondary']),
    }),
  ),
  userJourneys: z.array(z.object({ name: z.string(), steps: z.array(z.string()) })),
  brand: z.object({
    colors: z.object({
      primary: z.string(),
      secondary: nullableString,
      accent: nullableString,
      background: nullableString,
      text: nullableString,
    }),
    fonts: z.array(z.string()),
    logoPath: nullableString,
    voice: z.string(),
  }),
  evidence: z.array(z.string()),
})

export const readProductBrief = (answer: unknown): Result<ProductBrief, AnswerRejected> => {
  if (answer === undefined || answer === null) return err({ problems: "La réponse ne contient pas d'objet JSON." })

  const document = documentSchema.safeParse(answer)
  if (!document.success) {
    const issues = document.error.issues.map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
    return err({ problems: issues.slice(0, 8).join('\n') })
  }

  const brief = ProductBrief.create(document.data)
  return brief.ok ? brief : err({ problems: brief.error.violations.join('\n') })
}
