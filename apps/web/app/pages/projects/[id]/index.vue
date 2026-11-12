<script setup lang="ts">
import type { ProjectDto } from '#shared/types/api'

defineProps<{
  project: ProjectDto
  analysis: ReturnType<typeof useAnalysisRequest>
}>()

const { claudeCode, ready } = useSetup()
</script>

<template>
  <div v-if="project.analysis.status === 'not_started'" class="done">
    <ClaudeCodeNotice v-if="claudeCode" :claude-code="claudeCode" />
    <BriefAnalysisStart
      :pending="analysis.pending.value"
      :folder="project.folder.name"
      :ready="ready"
      @start="analysis.request"
    />
  </div>

  <BriefAnalysisRunning
    v-else-if="project.analysis.status === 'queued' || project.analysis.status === 'running'"
    :analysis="project.analysis"
    :folder="project.folder.name"
  />

  <BriefAnalysisFailed
    v-else-if="project.analysis.status === 'failed'"
    :reason="project.analysis.reason"
    :failed-at="project.analysis.failedAt"
    :pending="analysis.pending.value"
    @retry="analysis.request"
  />

  <div v-else class="done">
    <BriefDocument :brief="project.analysis.brief" :completed-at="project.analysis.completedAt" />
    <NuxtLink :to="`/projects/${project.id}/personas`" class="next">
      <span class="next__label">Étape suivante</span>
      <span class="next__title">Personas</span>
      <span class="next__text">
        À partir des {{ project.analysis.brief.audiences.length }} audiences du brief, Claude imagine vos utilisateurs
        types, chacun avec son accroche.
      </span>
    </NuxtLink>
  </div>
</template>

<style scoped>
.done {
  display: grid;
  gap: 1rem;
}

.next {
  display: grid;
  gap: 0.2rem;
  padding: 1.5rem;
  border-radius: var(--r-tile);
  border: 1px dashed var(--line-strong);
  text-decoration: none;
  transition: border-color 120ms;
}

.next:hover {
  border-color: var(--caption);
  border-style: solid;
}

.next__label {
  font-size: var(--t-xs);
  color: var(--faint);
}

.next__title {
  font-family: var(--display);
  font-weight: 750;
  font-size: var(--t-xl);
  letter-spacing: -0.03em;
}

.next__text {
  color: var(--muted);
  max-width: 70ch;
}
</style>
