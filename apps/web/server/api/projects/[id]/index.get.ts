import { ProjectId } from '@repo-motion/core'
import { defineEventHandler, getRouterParam } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const { getProject } = await useCases()
  return presentProject(unwrap(await getProject.execute({ projectId })))
})
