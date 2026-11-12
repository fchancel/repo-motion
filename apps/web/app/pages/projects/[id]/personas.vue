<script setup lang="ts">
import type { ProjectDto } from '#shared/types/api'

const props = defineProps<{ project: ProjectDto }>()

const { claudeCode, ready } = useSetup()
const request = usePersonasRequest(() => props.project.id)

const brief = computed(() => (props.project.analysis.status === 'succeeded' ? props.project.analysis.brief : null))
const state = computed(() => props.project.personas)
const pending = computed(() => state.value.status === 'queued' || state.value.status === 'running')
const since = computed(() => {
  const current = state.value
  return current.status === 'running' ? current.startedAt : current.status === 'queued' ? current.requestedAt : null
})

// New personas make the videos obsolete: say so before discarding them.
const confirmingRewrite = ref(false)
const rewrite = () => {
  if (props.project.videos.length > 0) confirmingRewrite.value = true
  else void request.request()
}
const confirmRewrite = () => {
  confirmingRewrite.value = false
  void request.request()
}

/** While Claude writes, placeholders stand in for the personas, one per audience. */
const audiences = computed(() => brief.value?.audiences.slice(0, 4) ?? [])
</script>

<template>
  <!-- No brief yet: personas cannot exist. -->
  <ProjectStageGate
    v-if="!brief"
    state="locked"
    :previous="{ label: 'le brief produit', to: `/projects/${project.id}` }"
    title="Un persona par audience."
    text="Les personas s'appuient sur le brief produit : ce que fait l'application et à qui elle s'adresse. Lancez d'abord l'analyse du code."
  >
    <ul class="ghosts" aria-hidden="true">
      <li v-for="n in 3" :key="n" :style="{ '--hue': personaHue(n - 1) }"><span /><span /><span /></li>
    </ul>
  </ProjectStageGate>

  <div v-else class="stack">
    <p v-if="request.error.value" class="error" role="alert">{{ request.error.value }}</p>

    <!-- Nothing written yet. -->
    <template v-if="state.status === 'not_started'">
      <ClaudeCodeNotice v-if="claudeCode" :claude-code="claudeCode" />
      <section class="start">
        <div class="start__text">
          <h2>Qui va regarder vos vidéos ?</h2>
          <p class="lead">
            À partir du brief, Claude imagine vos utilisateurs types : ce qui les frustre, ce qu'ils espèrent, ce qui les
            retient, et la phrase qui les arrêtera de scroller. Chaque persona recevra sa propre vidéo.
          </p>
          <div class="start__actions">
            <UiButton size="lg" :loading="request.pending.value" :disabled="!ready" @click="request.request">
              Écrire les personas
            </UiButton>
            <span class="start__note">Environ une minute. Claude travaille à partir du brief, sans relire le code.</span>
          </div>
        </div>
        <div class="start__audiences">
          <h3>Les audiences repérées dans le brief</h3>
          <ol>
            <li v-for="(audience, index) in brief.audiences" :key="audience" :style="{ '--hue': personaHue(index) }">
              {{ audience }}
            </li>
          </ol>
        </div>
      </section>
    </template>

    <!-- Claude is writing. -->
    <section v-else-if="pending" class="writing" aria-live="polite">
      <div class="writing__text">
        <UiStatus tone="rec" :label="state.status === 'queued' ? 'En file d\'attente' : 'Rédaction en cours'" />
        <h2>Claude imagine vos personas.</h2>
        <p v-if="since" class="clock"><MotionTimecode :since="since" /></p>
        <p class="muted">Vous pouvez changer de page : la rédaction continue tant que repo-motion reste ouvert.</p>
      </div>
      <ul class="ghosts ghosts--live" aria-hidden="true">
        <li v-for="(audience, index) in audiences" :key="audience" :style="{ '--hue': personaHue(index), '--i': index }">
          <span /><span /><span />
        </li>
      </ul>
    </section>

    <BriefAnalysisFailed
      v-else-if="state.status === 'failed'"
      title="Les personas n'ont pas pu être écrits"
      retry-label="Réessayer"
      :reason="state.reason"
      :failed-at="state.failedAt"
      :pending="request.pending.value"
      @retry="request.request"
    />

    <!-- The personas. -->
    <template v-else-if="state.status === 'succeeded'">
      <header class="summary">
        <p>
          <strong>{{ state.personas.length }} personas</strong>, écrits par Claude {{ fromNow(state.completedAt) }} à
          partir du brief.
        </p>
        <UiButton variant="secondary" :loading="request.pending.value" :disabled="!ready" @click="rewrite">
          Réécrire les personas
        </UiButton>
      </header>

      <PersonaCard
        v-for="(persona, index) in state.personas"
        :key="persona.name"
        :persona="persona"
        :hue="personaHue(index)"
      />

      <NuxtLink :to="`/projects/${project.id}/videos`" class="next">
        <span class="next__label">Étape suivante</span>
        <span class="next__title">Vidéos</span>
        <span class="next__text">Une vidéo verticale par persona, construite autour de son accroche.</span>
      </NuxtLink>

      <UiDialog
        v-model:open="confirmingRewrite"
        title="Réécrire les personas ?"
        description="De nouveaux personas remplaceront ceux-ci. Leurs vidéos seront supprimées et à générer de nouveau."
      >
        <div class="dialog-actions">
          <UiButton variant="ghost" @click="confirmingRewrite = false">Annuler</UiButton>
          <UiButton @click="confirmRewrite">Réécrire</UiButton>
        </div>
      </UiDialog>
    </template>
  </div>
</template>

<style scoped>
.stack {
  display: grid;
  gap: 1rem;
}

.error {
  color: var(--rec);
}

/* ── Start ── */

.start,
.writing {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(1.5rem, 5vw, 4rem);
  padding: clamp(1.5rem, 4vw, 3rem);
  border-radius: var(--r-tile);
  border: 1px solid var(--line);
  background: var(--surface);
}

.start__text,
.writing__text {
  display: grid;
  gap: 1.1rem;
  justify-items: start;
}

.start h2,
.writing h2 {
  max-width: 14ch;
  font-size: var(--t-3xl);
  font-stretch: 85%;
}

.lead {
  max-width: 52ch;
  color: var(--muted);
  font-size: 1.05rem;
}

.start__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.start__note {
  max-width: 34ch;
  color: var(--muted);
  font-size: var(--t-sm);
}

.start__audiences h3 {
  margin-bottom: 0.8rem;
  font-size: var(--t-sm);
  font-weight: 600;
  color: var(--muted);
}

.start__audiences ol {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.6rem;
}

.start__audiences li {
  padding: 0.6rem 0.9rem;
  border-radius: 14px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--hue);
  background: var(--surface-raised);
  font-size: var(--t-sm);
}

/* ── Writing ── */

.writing {
  background:
    radial-gradient(60% 90% at 0% 0%, rgb(255 82 71 / 0.16), transparent 70%),
    var(--surface);
}

.clock {
  font-size: clamp(2.4rem, 6vw, 4.2rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.04em;
}

.muted {
  max-width: 46ch;
  color: var(--muted);
}

/* Placeholder cards: a persona being written. */
.ghosts {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.7rem;
}

.ghosts li {
  display: grid;
  grid-template-columns: 2.6rem 1fr;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 0.4rem 0.9rem;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  border: 1px solid var(--line);
  background:
    radial-gradient(60% 160% at 0% 50%, color-mix(in srgb, var(--hue) 24%, transparent), transparent 70%),
    var(--surface-raised);
}

.ghosts li:nth-child(even) {
  margin-left: 1.5rem;
}

.ghosts span:first-child {
  grid-row: span 2;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 50%;
  background: var(--hue);
}

.ghosts span:nth-child(2),
.ghosts span:nth-child(3) {
  height: 7px;
  border-radius: 4px;
  background: rgb(255 255 255 / 0.12);
}

.ghosts span:nth-child(2) {
  width: 55%;
}

.ghosts span:nth-child(3) {
  width: 80%;
}

.ghosts--live li {
  animation: breathe 1.8s ease-in-out infinite;
  animation-delay: calc(var(--i) * 250ms);
}

@keyframes breathe {
  50% {
    opacity: 0.45;
  }
}

/* ── Done ── */

.summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  color: var(--muted);
}

.summary strong {
  color: var(--text);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
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
}

@media (max-width: 860px) {
  .start,
  .writing {
    grid-template-columns: 1fr;
  }
}
</style>
