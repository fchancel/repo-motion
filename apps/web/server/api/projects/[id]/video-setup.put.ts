import { ProjectId } from '@repo-motion/core'
import { defineEventHandler, getRouterParam, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

/** Shape only: what makes a setup valid is the domain's business. */
const body = z.object({
  production: z.string().max(40),
  demo: z.object({ mode: z.string().max(40), addresses: z.array(z.string().max(2000)).max(20) }),
  track: z.string().max(1000).nullable(),
})

/** Records what all the project's videos share: how the application is shown, and the user's own music. */
export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const setup = await readValidatedBody(event, body)
  const { setUpVideos } = await useCases()
  return presentProject(unwrap(await setUpVideos.execute({ projectId, setup })))
})
