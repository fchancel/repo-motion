import { ProjectId } from '@repo-motion/core'
import { defineEventHandler, getRouterParam, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const body = z.object({
  /** Null: every persona at once. */
  persona: z.string().min(1).max(200).nullable(),
  /** Null: back to what Claude proposed. */
  style: z.object({ look: z.string().max(40), tone: z.string().max(40), sound: z.string().max(40) }).nullable(),
})

/** Records the style the user wants for a persona's videos, in place of Claude's proposal. */
export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const { persona, style } = await readValidatedBody(event, body)
  const { chooseStyle } = await useCases()
  return presentProject(unwrap(await chooseStyle.execute({ projectId, persona, style })))
})
