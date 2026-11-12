<script setup lang="ts">
import type { AnalysisDto } from '#shared/types/api'

/** While the analysis runs. No fake progress bar: an honest timer, and what Claude is reading. */
const props = defineProps<{ analysis: Extract<AnalysisDto, { status: 'queued' | 'running' }>; folder: string }>()

const since = computed(() => (props.analysis.status === 'running' ? props.analysis.startedAt : props.analysis.requestedAt))
const queued = computed(() => props.analysis.status === 'queued')
const activity = computed(() => (props.analysis.status === 'running' ? props.analysis.activity : null))
</script>

<template>
  <section class="running" aria-live="polite">
    <div class="running__text">
      <UiStatus tone="rec" :label="queued ? 'En file d\'attente' : 'Analyse en cours'" />
      <h2>{{ queued ? 'Claude Code démarre.' : 'Claude lit votre code.' }}</h2>
      <p class="clock"><MotionTimecode :since="since" /></p>
      <p v-if="activity" class="activity mono">{{ activity }}</p>
      <p class="muted">
        Claude Code lit votre dossier sur cette machine, en lecture seule, puis rédige le brief. Comptez quelques
        minutes. Vous pouvez changer de page : l'analyse continue tant que repo-motion reste ouvert.
      </p>
    </div>

    <MotionCodeWindow class="running__code" abstract :title="folder" />
  </section>
</template>

<style scoped>
.running {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  align-items: center;
  gap: clamp(1.5rem, 5vw, 4rem);
  padding: clamp(1.5rem, 4vw, 3rem);
  overflow: hidden;
  border-radius: var(--r-tile);
  border: 1px solid var(--line);
  background:
    radial-gradient(60% 90% at 0% 0%, rgb(255 82 71 / 0.16), transparent 70%),
    var(--surface);
}

.running__text {
  display: grid;
  gap: 1rem;
  justify-items: start;
}

.running__text h2 {
  font-size: var(--t-3xl);
  font-stretch: 85%;
}

.clock {
  font-size: clamp(2.6rem, 7vw, 5rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.04em;
}

.activity {
  max-width: 100%;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  color: var(--caption);
  overflow-wrap: anywhere;
}

.muted {
  max-width: 48ch;
  color: var(--muted);
}

.running__code {
  transform: rotate(1.5deg);
  box-shadow: 0 30px 60px -30px rgb(0 0 0 / 0.9);
}

@media (max-width: 820px) {
  .running {
    grid-template-columns: 1fr;
  }

  .running__code {
    transform: none;
  }
}
</style>
