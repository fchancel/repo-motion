import { ProjectId } from '@repo-motion/core'
import { defineEventHandler, getRouterParam } from 'nuxt/server'

/** Has Claude propose a style for each persona. Answers once it has: a few tens of seconds. */
export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const { suggestStyles } = await useCases()
  return presentProject(unwrap(await suggestStyles.execute({ projectId })))
})
