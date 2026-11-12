<script setup lang="ts">
import type { ProjectDto } from '#shared/types/api'

/**
 * Adds a project from a folder path. The browser cannot browse the disk, but the local
 * server can: it suggests folders as the user types.
 */
const props = withDefaults(defineProps<{ size?: 'md' | 'lg'; autofocus?: boolean }>(), { size: 'md', autofocus: false })
const emit = defineEmits<{ added: [project: ProjectDto] }>()

const folder = ref('')
const suggestions = ref<string[]>([])
const pending = ref(false)
const error = ref<string | null>(null)
const listId = useId()

let timer: ReturnType<typeof setTimeout> | undefined
let latest = 0
watch(folder, (value) => {
  clearTimeout(timer)
  error.value = null
  timer = setTimeout(async () => {
    const request = ++latest
    const found = await $fetch<string[]>('/api/folders', { query: { input: value } }).catch(() => [])
    // Ignore answers that arrive after a newer keystroke.
    if (request === latest) suggestions.value = found.filter((path) => path !== value)
  }, 120)
})
onBeforeUnmount(() => clearTimeout(timer))

/** Picking a suggestion keeps browsing: the trailing slash lists what is inside. */
const pick = (path: string) => {
  folder.value = `${path}/`
}

const submit = async (value = folder.value) => {
  pending.value = true
  error.value = null
  try {
    const project = await $fetch<ProjectDto>('/api/projects', { method: 'POST', body: { folder: value } })
    await refreshNuxtData('projects')
    folder.value = ''
    emit('added', project)
    await navigateTo(`/projects/${project.id}`)
  } catch (caught) {
    const { type, projectId } = apiErrorData(caught)
    if (type === 'ProjectAlreadyAdded' && projectId) return navigateTo(`/projects/${projectId}`)
    error.value = apiErrorMessage(caught)
  } finally {
    pending.value = false
  }
}

defineExpose({ submit })
</script>

<template>
  <form class="folder-form" :data-size="props.size" @submit.prevent="submit()">
    <UiField label="Dossier du projet" hint="Un chemin sur cette machine, par exemple ~/Projects/mon-app" :error="error">
      <template #default="{ id, describedBy, invalid }">
        <div class="folder-form__row">
          <UiInput
            :id="id"
            v-model="folder"
            mono
            :invalid="invalid"
            :aria-describedby="describedBy"
            :aria-controls="listId"
            placeholder="~/Projects/mon-app"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            required
            :autofocus="autofocus"
          />
          <UiButton type="submit" :size="props.size" :loading="pending">Ajouter le projet</UiButton>
        </div>
      </template>
    </UiField>

    <ul v-if="suggestions.length" :id="listId" class="folder-form__suggestions" aria-label="Dossiers correspondants">
      <li v-for="path in suggestions" :key="path">
        <button type="button" @click="pick(path)">{{ path }}</button>
      </li>
    </ul>
  </form>
</template>

<style scoped>
.folder-form {
  display: grid;
  gap: 0.75rem;
  text-align: left;
}

.folder-form__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.folder-form__row > :first-child {
  flex: 1 1 280px;
}

.folder-form[data-size='lg'] :deep(.input) {
  padding: 0.95rem 1.1rem;
  font-size: 1rem;
  border-radius: 999px;
}

.folder-form__suggestions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.folder-form__suggestions button {
  font: 500 var(--t-xs) var(--mono);
  color: var(--muted);
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: transparent;
  cursor: pointer;
  max-width: 100%;
  text-align: left;
  overflow-wrap: anywhere;
}

.folder-form__suggestions button:hover {
  color: var(--text);
  border-color: var(--caption);
}
</style>
