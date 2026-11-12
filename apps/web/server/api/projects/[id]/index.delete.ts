import { ProjectId } from '@repo-motion/core'
import { defineEventHandler, getRouterParam, setResponseStatus } from 'nuxt/server'

/** Forgets the project. The folder on disk is never touched. */
export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const { removeProject } = await useCases()

  unwrap(await removeProject.execute({ projectId }))
  setResponseStatus(event, 204)
  return null
})
