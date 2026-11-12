import { ProjectId } from '@repo-motion/core'
import { defineEventHandler, getRouterParam, setResponseStatus } from 'nuxt/server'

/** Asks for the personas to be written, or written again, from the project's brief. */
export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const { requestPersonas } = await useCases()

  setResponseStatus(event, 202)
  return presentProject(unwrap(await requestPersonas.execute({ projectId })))
})
