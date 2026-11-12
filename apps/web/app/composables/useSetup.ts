import type { SetupDto } from '#shared/types/api'

/** What this machine offers: the state of Claude Code, and the folder the app was launched from. */
export const useSetup = () => {
  const state = useFetch<SetupDto>('/api/setup', { key: 'setup' })
  const claudeCode = computed(() => state.data.value?.claudeCode ?? null)
  const ready = computed(() => claudeCode.value?.state === 'ready')

  return { ...state, setup: state.data, claudeCode, ready }
}
