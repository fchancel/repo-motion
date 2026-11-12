<script setup lang="ts">
import type { ProjectDto } from '#shared/types/api'

const props = defineProps<{ project: ProjectDto }>()

const { claudeCode, ready } = useSetup()
const videos = useVideoRequests(() => props.project.id)
const styles = useVideoStyles(() => props.project.id)

const brief = computed(() => (props.project.analysis.status === 'succeeded' ? props.project.analysis.brief : null))
const personas = computed(() => (props.project.personas.status === 'succeeded' ? props.project.personas.personas : []))

/** Each persona with the style of their next video, and their video if one was asked for. */
const rows = computed(() =>
  personas.value.flatMap((persona, index) => {
    const entry = props.project.styles.find((style) => style.persona === persona.name)
    if (!entry) return []
    const made = props.project.videos.find((video) => video.persona === persona.name)
    return [{ persona, entry, hue: personaHue(index), video: made?.video ?? null, scripts: made?.scripts ?? null }]
  }),
)

/** Claude has not proposed a style for everyone yet. */
const unadvised = computed(() => rows.value.some(({ entry }) => !entry.suggestion))

/** The thumbnails of the art directions are drawn in the product's own colours. */
const brandColors = computed(() => {
  const colors = brief.value?.brand.colors
  if (!colors) return {}
  return {
    '--brand': colors.primary,
    '--brand-bg': colors.background ?? '#08080d',
    '--brand-second': colors.secondary ?? colors.accent ?? colors.primary,
    '--brand-third': colors.accent ?? colors.secondary ?? colors.primary,
  }
})

/** The personas whose video is still to make, or to make again after a failure. */
const missing = computed(() => rows.value.filter(({ video }) => !video || video.status === 'failed').map(({ persona }) => persona.name))
const counts = computed(() => videoCounts(props.project))

/** What every script must hold, for the locked screen. */
const beats = [
  { label: 'Accroche', seconds: 2.5, text: 'Une question qu’on veut voir résolue' },
  { label: 'Ce que c’est', seconds: 3, text: 'Dit simplement, avant la 6e seconde' },
  { label: 'Preuve', seconds: 6, text: 'Le produit à l’œuvre, à l’écran' },
  { label: 'Relance', seconds: 3, text: 'Une nouvelle raison de rester' },
  { label: 'Réponse', seconds: 3, text: 'La question du début, résolue' },
  { label: 'Action', seconds: 2.5, text: 'Ce qu’il reste à faire' },
]
</script>

<template>
  <!-- Videos are written for personas: without them, nothing to show. -->
  <ProjectStageGate
    v-if="rows.length === 0"
    state="locked"
    :previous="
      brief
        ? { label: 'les personas', to: `/projects/${project.id}/personas` }
        : { label: 'le brief produit', to: `/projects/${project.id}` }
    "
    title="Une vidéo par persona."
    text="Chaque vidéo est écrite pour un persona, à partir de scripts testés. Il faut d'abord le brief, puis les personas."
  >
    <div class="locked-preview">
      <MotionPhoneFrame width="min(46%, 210px)" safe-zones label="Cadre 9:16 avec zones masquées par les plateformes" />
      <MotionBeatTimeline :beats="beats" class="locked-preview__timeline" />
    </div>
  </ProjectStageGate>

  <div v-else-if="brief" class="stack" :style="brandColors">
    <ClaudeCodeNotice v-if="claudeCode && missing.length > 0" :claude-code="claudeCode" />

    <section class="intro">
      <div class="intro__text">
        <h2>Une vidéo par persona.</h2>
        <p>
          Pour chaque persona, Claude écrit trois scripts et les fait regarder à froid par des spectateurs qui ne
          connaissent pas {{ brief.productName }}. Il les réécrit là où ils ont décroché, et vous choisissez celui à
          réaliser. La vidéo est ensuite rendue en MP4 vertical, aux couleurs et avec le logo du produit.
        </p>
        <div class="intro__actions">
          <UiButton
            v-if="missing.length > 0"
            size="lg"
            :loading="videos.pending.value.length > 0"
            :disabled="!ready"
            @click="videos.requestAll(missing)"
          >
            {{ missing.length === rows.length ? `Générer les ${rows.length} vidéos` : `Générer les ${missing.length} restantes` }}
          </UiButton>
          <UiStatus v-if="counts.toChoose > 0" tone="idle" :label="counts.toChoose > 1 ? `${counts.toChoose} scripts à choisir` : 'Un script à choisir'" />
          <UiStatus v-if="counts.pending > 0" tone="rec" :label="`${counts.pending} en production`" />
          <UiStatus v-else-if="missing.length === 0 && counts.toChoose === 0" tone="ok" :label="`${counts.ready} vidéos prêtes`" />
        </div>
        <div class="intro__actions">
          <UiButton variant="secondary" :loading="styles.suggesting.value" :disabled="!ready" @click="styles.suggest()">
            {{ unadvised ? 'Demander un style par persona à Claude' : 'Redemander des styles à Claude' }}
          </UiButton>
          <span v-if="styles.suggesting.value" class="intro__hint">Claude réfléchit à chaque persona. Une trentaine de secondes.</span>
        </div>
        <p v-if="videos.error.value || styles.error.value" class="error" role="alert">{{ videos.error.value ?? styles.error.value }}</p>
      </div>

      <dl class="facts">
        <div>
          <dt>Format</dt>
          <dd>MP4 vertical 9:16, 1080 × 1920</dd>
        </div>
        <div>
          <dt>Durée</dt>
          <dd>12 à 45 secondes quand Claude la réalise, 12 à 28 en mode rapide</dd>
        </div>
        <div>
          <dt>Cadrage</dt>
          <dd>Rien d'important sous les boutons et la légende des plateformes</dd>
        </div>
      </dl>
    </section>

    <VideoSetupPanel :project-id="project.id" :setup="project.videoSetup" />

    <VideoCard
      v-for="row in rows"
      :key="row.persona.name"
      :persona="row.persona"
      :brief="brief"
      :hue="row.hue"
      :video="row.video"
      :requesting="videos.pending.value.includes(row.persona.name)"
      :ready="ready"
      :entry="row.entry"
      :setup="project.videoSetup"
      :scripts="row.scripts"
      :choosing="videos.choosing.value.includes(row.persona.name)"
      :choose-error="videos.choiceErrors.value[row.persona.name] ?? null"
      @generate="videos.request(row.persona.name)"
      @pick="(index, texts) => videos.choose(row.persona.name, index, texts)"
      @choose="styles.choose(row.persona.name, $event)"
      @reset="styles.choose(row.persona.name, null)"
      @everyone="styles.choose(null, row.entry.style)"
    />
  </div>
</template>

<style scoped>
.stack {
  display: grid;
  gap: 1.5rem;
}

.intro {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(1.5rem, 5vw, 4rem);
  padding: clamp(1.5rem, 4vw, 3rem);
  border-radius: var(--r-tile);
  border: 1px solid var(--line);
  background: var(--surface);
}

.intro__text {
  display: grid;
  gap: 1rem;
  justify-items: start;
}

.intro h2 {
  font-size: var(--t-3xl);
  font-stretch: 85%;
}

.intro__text p {
  max-width: 54ch;
  color: var(--muted);
}

.intro__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.intro__hint {
  color: var(--muted);
  font-size: var(--t-sm);
}

.intro__text .error {
  color: var(--rec);
}

.facts {
  margin: 0;
  display: grid;
  gap: 0;
  font-size: var(--t-sm);
}

.facts div {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 1rem;
  padding: 0.7rem 0;
  border-top: 1px solid var(--line);
}

.facts dt {
  color: var(--faint);
}

.facts dd {
  margin: 0;
}

.locked-preview {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.locked-preview__timeline {
  flex: 1;
  min-width: 0;
}

@media (max-width: 860px) {
  .intro {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .locked-preview {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
