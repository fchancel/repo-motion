import { ProjectId } from '@repo-motion/core'
import { defineEventHandler, getRouterParam, readValidatedBody, setResponseStatus } from 'nuxt/server'
import { z } from 'zod'

const body = z.object({
  persona: z.string().min(1).max(200),
  index: z.number().int().min(0).max(10),
  /** The user's own words on screen, one per beat. Null: the script as written. */
  texts: z.array(z.string().max(400)).max(20).nullable().default(null),
})

/** Picks the script of a persona's video: the video is then made from it, in the background. */
export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const { persona, index, texts } = await readValidatedBody(event, body)
  const { chooseScript } = await useCases()

  setResponseStatus(event, 202)
  return presentProject(unwrap(await chooseScript.execute({ projectId, persona, index, texts })))
})
