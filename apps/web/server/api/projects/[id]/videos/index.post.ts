import { ProjectId } from '@repo-motion/core'
import { defineEventHandler, getRouterParam, readValidatedBody, setResponseStatus } from 'nuxt/server'
import { z } from 'zod'

const body = z.object({ persona: z.string().min(1).max(200) })

/** Asks for one persona's video to be produced, or produced again. */
export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const { persona } = await readValidatedBody(event, body)
  const { requestVideo } = await useCases()

  setResponseStatus(event, 202)
  return presentProject(unwrap(await requestVideo.execute({ projectId, persona })))
})
