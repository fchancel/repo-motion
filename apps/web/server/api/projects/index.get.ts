import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async () => {
  const { listProjects } = await useCases()
  return (await listProjects.execute()).map(presentProject)
})
