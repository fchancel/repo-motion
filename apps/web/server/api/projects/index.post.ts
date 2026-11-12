import { defineEventHandler, readValidatedBody, setResponseStatus } from 'nuxt/server'
import { z } from 'zod'

const body = z.object({ folder: z.string().min(1).max(1000) })

export default defineEventHandler(async (event) => {
  const { folder } = await readValidatedBody(event, body)
  const { addProject } = await useCases()

  setResponseStatus(event, 201)
  return presentProject(unwrap(await addProject.execute({ folder })))
})
