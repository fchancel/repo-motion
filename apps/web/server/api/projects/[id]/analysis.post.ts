import { ProjectId } from '@repo-motion/core'
import { defineEventHandler, getRouterParam, setResponseStatus } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const projectId = ProjectId(getRouterParam(event, 'id') ?? '')
  const { requestAnalysis } = await useCases()

  setResponseStatus(event, 202)
  return presentProject(unwrap(await requestAnalysis.execute({ projectId })))
})
