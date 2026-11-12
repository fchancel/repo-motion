import { defineEventHandler, getQuery } from 'nuxt/server'

/** Folder suggestions while the user types a path. */
export default defineEventHandler(async (event): Promise<string[]> => {
  const { input } = getQuery<{ input?: string }>(event)
  const { suggestFolders } = await useCases()
  return suggestFolders.execute({ input: typeof input === 'string' ? input.slice(0, 1000) : '' })
})
