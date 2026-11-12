import { defineEventHandler } from 'nuxt/server'
import type { SetupDto } from '#shared/types/api'

export default defineEventHandler(async (): Promise<SetupDto> => {
  const { useCases, launchFolder } = await useApplication()
  return { claudeCode: await useCases.getClaudeCodeStatus.execute(), launchFolder }
})
