import type { ProjectDto, VideoSetupDto, VideoStyleDto } from '#shared/types/api'

const projectKey = (id: string) => `project:${id}`

/** The project shown by the workspace pages. Shared through its fetch key. */
export const useProject = (id: MaybeRefOrGetter<string>) =>
  useFetch<ProjectDto>(() => `/api/projects/${toValue(id)}`, { key: projectKey(toValue(id)) })

/** Starts a background stage, and puts the returned project straight into the shared cache. */
const useStageRequest = (id: MaybeRefOrGetter<string>, stage: 'analysis' | 'personas') => {
  const pending = ref(false)
  const error = ref<string | null>(null)

  const request = async () => {
    pending.value = true
    error.value = null
    try {
      const project = await $fetch<ProjectDto>(`/api/projects/${toValue(id)}/${stage}`, { method: 'POST' })
      useNuxtData<ProjectDto>(projectKey(toValue(id))).data.value = project
    } catch (caught) {
      error.value = apiErrorMessage(caught)
    } finally {
      pending.value = false
    }
  }

  return { request, pending, error }
}

/** Asks for videos, one persona at a time, and keeps track of which requests are on their way. */
export const useVideoRequests = (id: MaybeRefOrGetter<string>) => {
  const pending = ref<string[]>([])
  const error = ref<string | null>(null)

  const request = async (persona: string) => {
    pending.value = [...pending.value, persona]
    error.value = null
    try {
      const project = await $fetch<ProjectDto>(`/api/projects/${toValue(id)}/videos`, { method: 'POST', body: { persona } })
      useNuxtData<ProjectDto>(projectKey(toValue(id))).data.value = project
    } catch (caught) {
      error.value = apiErrorMessage(caught)
    } finally {
      pending.value = pending.value.filter((name) => name !== persona)
    }
  }

  /** One after the other: each answer carries the whole project, and the last one must win. */
  const requestAll = async (personas: string[]) => {
    for (const persona of personas) await request(persona)
  }

  /** The script picked for a persona's video, and why the last pick was refused, per persona. */
  const choosing = ref<string[]>([])
  const choiceErrors = ref<Record<string, string>>({})
  const choose = async (persona: string, index: number, texts: string[] | null) => {
    choosing.value = [...choosing.value, persona]
    const { [persona]: _, ...others } = choiceErrors.value
    choiceErrors.value = others
    try {
      const project = await $fetch<ProjectDto>(`/api/projects/${toValue(id)}/videos/script`, { method: 'POST', body: { persona, index, texts } })
      useNuxtData<ProjectDto>(projectKey(toValue(id))).data.value = project
    } catch (caught) {
      choiceErrors.value = { ...choiceErrors.value, [persona]: apiErrorMessage(caught) }
    } finally {
      choosing.value = choosing.value.filter((name) => name !== persona)
    }
  }

  return { request, requestAll, pending, error, choose, choosing, choiceErrors }
}

/** Sends a change of the project's video settings, and puts the answer straight into the shared cache. */
const useProjectChange = (id: MaybeRefOrGetter<string>) => {
  const pending = ref(false)
  const done = ref(false)
  const error = ref<string | null>(null)

  const send = async (path: string, method: 'PUT' | 'POST', body?: Record<string, unknown>) => {
    pending.value = true
    done.value = false
    error.value = null
    try {
      const project = await $fetch<ProjectDto>(`/api/projects/${toValue(id)}/${path}`, { method, ...(body ? { body } : {}) })
      useNuxtData<ProjectDto>(projectKey(toValue(id))).data.value = project
      done.value = true
    } catch (caught) {
      error.value = apiErrorMessage(caught)
    } finally {
      pending.value = false
    }
  }

  return { send, pending, done, error }
}

/** Saves what all the project's videos share: how the application is shown, the user's own music. */
export const useVideoSetup = (id: MaybeRefOrGetter<string>) => {
  const { send, pending, done, error } = useProjectChange(id)
  return { save: (setup: VideoSetupDto) => send('video-setup', 'PUT', { ...setup }), saving: pending, saved: done, error }
}

/** Each persona's style: choosing one, going back to Claude's proposal, asking Claude for proposals. */
export const useVideoStyles = (id: MaybeRefOrGetter<string>) => {
  const choice = useProjectChange(id)
  const suggestions = useProjectChange(id)

  return {
    /** `persona` null: for everyone. `style` null: back to what Claude proposed. */
    choose: (persona: string | null, style: VideoStyleDto | null) => choice.send('video-styles', 'PUT', { persona, style }),
    suggest: () => suggestions.send('video-styles/suggestions', 'POST'),
    suggesting: suggestions.pending,
    error: computed(() => choice.error.value ?? suggestions.error.value),
  }
}

export const useAnalysisRequest = (id: MaybeRefOrGetter<string>) => useStageRequest(id, 'analysis')
export const usePersonasRequest = (id: MaybeRefOrGetter<string>) => useStageRequest(id, 'personas')
