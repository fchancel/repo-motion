<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: project, error, refresh } = await useProject(id)
const analysis = useAnalysisRequest(id)

useHead({
  title: () =>
    project.value?.analysis.status === 'succeeded'
      ? project.value.analysis.brief.productName
      : (project.value?.folder.name ?? 'Projet'),
})

const stages = computed(() => (project.value ? projectStages(project.value) : []))
const current = computed<StageKey>(() => {
  if (route.name === 'projects-id-personas') return 'personas'
  if (route.name === 'projects-id-videos') return 'videos'
  return 'brief'
})

const brief = computed(() => (project.value?.analysis.status === 'succeeded' ? project.value.analysis.brief : null))
const running = computed(() => (project.value ? projectIsBusy(project.value) : false))
// A failed analysis offers its own retry button, next to the reason.
const canRerun = computed(() => project.value?.analysis.status === 'succeeded' && !running.value && current.value === 'brief')

// A new brief makes the personas obsolete: say so before discarding them.
const confirmingReanalysis = ref(false)
const reanalyse = () => {
  if (project.value?.personas.status === 'succeeded') confirmingReanalysis.value = true
  else void analysis.request()
}
const confirmReanalysis = () => {
  confirmingReanalysis.value = false
  void analysis.request()
}

const removing = ref(false)
const removePending = ref(false)
const removeError = ref<string | null>(null)

const remove = async () => {
  removePending.value = true
  removeError.value = null
  try {
    await $fetch(`/api/projects/${id.value}`, { method: 'DELETE' })
    await refreshNuxtData('projects')
    await navigateTo('/')
  } catch (caught) {
    removeError.value = apiErrorMessage(caught)
  } finally {
    removePending.value = false
  }
}

// Analyses, personas and videos run in the background: poll while the project is busy.
let timer: ReturnType<typeof setInterval> | undefined
watch(
  running,
  (active) => {
    clearInterval(timer)
    if (active && import.meta.client) timer = setInterval(() => refresh(), 2_000)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div v-if="error" class="missing">
    <h1>Projet introuvable</h1>
    <p>Il a peut-être été retiré de vos projets.</p>
    <UiButton to="/" variant="secondary">Retour aux projets</UiButton>
  </div>

  <div v-else-if="project" class="workspace" :style="{ '--brand': brief?.brand.colors.primary ?? 'var(--faint)' }">
    <UiPageHeader :title="brief?.productName ?? project.folder.name">
      <template #before>
        <nav class="crumbs" aria-label="Fil d'Ariane">
          <NuxtLink to="/">Projets</NuxtLink>
          <span aria-hidden="true">/</span>
          <span class="mono">{{ project.folder.path }}</span>
        </nav>
      </template>
      <template #actions>
        <UiButton v-if="canRerun" variant="secondary" :loading="analysis.pending.value" @click="reanalyse">
          Réanalyser le code
        </UiButton>
        <UiButton v-if="!running" variant="ghost" @click="removing = true">Retirer</UiButton>
      </template>
    </UiPageHeader>

    <MotionPipelineTrack :stages="stages" :current="current" class="track" />

    <p v-if="analysis.error.value" class="request-error" role="alert">{{ analysis.error.value }}</p>

    <NuxtPage :project="project" :analysis="analysis" />

    <UiDialog
      v-model:open="confirmingReanalysis"
      title="Réanalyser le code ?"
      description="Un nouveau brief remplacera l'actuel. Les personas et les vidéos, faits à partir de l'ancien brief, seront à refaire."
    >
      <div class="dialog-actions">
        <UiButton variant="ghost" @click="confirmingReanalysis = false">Annuler</UiButton>
        <UiButton @click="confirmReanalysis">Réanalyser</UiButton>
      </div>
    </UiDialog>

    <UiDialog
      v-model:open="removing"
      title="Retirer ce projet ?"
      description="Le brief, les personas et les vidéos de ce projet seront supprimés. Le dossier et son code ne sont pas touchés."
    >
      <p v-if="removeError" class="request-error" role="alert">{{ removeError }}</p>
      <div class="dialog-actions">
        <UiButton variant="ghost" @click="removing = false">Annuler</UiButton>
        <UiButton variant="danger" :loading="removePending" @click="remove">Retirer le projet</UiButton>
      </div>
    </UiDialog>
  </div>
</template>

<style scoped>
/* The stage takes the colour of the product being worked on. */
.workspace::before {
  content: '';
  position: absolute;
  inset: -90px -10% auto;
  height: 520px;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(55% 100% at 28% 0%, color-mix(in srgb, var(--brand) 42%, transparent), transparent 72%);
}

.crumbs {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: var(--t-sm);
  color: var(--faint);
}

.crumbs a {
  color: var(--muted);
  text-decoration: none;
}

.crumbs a:hover {
  color: var(--text);
}

.crumbs .mono {
  overflow-wrap: anywhere;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.track {
  margin-bottom: 2rem;
}

.request-error {
  color: var(--rec);
  margin: -0.75rem 0 1.25rem;
}

.missing {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  max-width: 40ch;
  padding-top: 3rem;
}

.missing p {
  color: var(--muted);
}
</style>
