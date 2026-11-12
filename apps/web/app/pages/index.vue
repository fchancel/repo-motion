<script setup lang="ts">
import type { ProjectDto } from '#shared/types/api'

useHead({ title: 'repo-motion' })

const { setup, claudeCode } = useSetup()
const { data: projects, refresh } = await useFetch<ProjectDto[]>('/api/projects', { key: 'projects', default: () => [] })

const adding = ref(false)
const form = useTemplateRef('form')

const headline = ['Votre', 'code', 'devient', 'des', 'vidéos', 'courtes.']
const launchFolder = computed(() => setup.value?.launchFolder ?? null)
const launchName = computed(() => launchFolder.value?.split(/[\\/]/).filter(Boolean).at(-1) ?? '')

// Keep statuses fresh while an analysis runs in the background.
const anyRunning = computed(() => projects.value.some(projectIsBusy))
let timer: ReturnType<typeof setInterval> | undefined
watch(
  anyRunning,
  (running) => {
    clearInterval(timer)
    if (running && import.meta.client) timer = setInterval(() => refresh(), 5_000)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <!-- First run: the pitch, and the one thing to do. -->
  <div v-if="projects.length === 0" class="welcome">
    <h1 class="welcome__title" aria-label="Votre code devient des vidéos courtes.">
      <span v-for="(word, i) in headline" :key="word" class="welcome__word" :style="{ '--i': i }" aria-hidden="true">{{
        word
      }}</span>
    </h1>
    <p class="welcome__lead">
      Indiquez le dossier de votre application. Claude Code le lit sur votre machine, comprend à qui elle s'adresse et
      prépare une vidéo verticale pour chacun de vos utilisateurs types.
    </p>

    <ClaudeCodeNotice v-if="claudeCode" :claude-code="claudeCode" class="welcome__notice" />

    <div class="welcome__form">
      <ProjectFolderForm ref="form" size="lg" />
      <button v-if="launchFolder" type="button" class="welcome__here" @click="form?.submit(launchFolder)">
        Utiliser le dossier courant : <strong>{{ launchName }}</strong>
      </button>
    </div>

    <div class="fan">
      <figure
        v-for="(sample, i) in SAMPLE_REELS"
        :key="sample.persona"
        class="fan__item"
        :data-slot="['left', 'center', 'right'][i]"
      >
        <MotionReelPlayer :reel="sample.reel" width="100%" :delay="i * 900" />
        <figcaption>
          <span class="fan__dot" :style="{ background: sample.reel.color }" />
          {{ sample.persona }}
        </figcaption>
      </figure>
    </div>
    <p class="fan__legend">
      Exemple avec {{ SAMPLE_PRODUCT }}, une application de planning : un produit, trois personas, trois vidéos.
    </p>
  </div>

  <div v-else>
    <UiPageHeader title="Vos projets" description="Chaque projet part d'un dossier et aboutit à des vidéos 9:16, une par persona.">
      <template #actions>
        <UiButton size="lg" @click="adding = true">Ajouter un projet</UiButton>
      </template>
    </UiPageHeader>

    <ClaudeCodeNotice v-if="claudeCode" :claude-code="claudeCode" class="notice" />

    <section class="grid" aria-label="Vos projets">
      <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
    </section>

    <ProjectAddProjectDialog v-model:open="adding" />
  </div>
</template>

<style scoped>
.notice {
  margin-bottom: 1.5rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 430px), 1fr));
  gap: 1rem;
}

/* ── Welcome ── */

.welcome {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* The stage lights. */
.welcome::before {
  content: '';
  position: absolute;
  inset: auto -10% -6% -10%;
  height: 60%;
  z-index: -1;
  background:
    radial-gradient(38% 60% at 22% 70%, rgb(255 107 74 / 0.3), transparent 70%),
    radial-gradient(38% 60% at 50% 60%, rgb(124 140 255 / 0.32), transparent 70%),
    radial-gradient(38% 60% at 78% 70%, rgb(62 230 168 / 0.26), transparent 70%);
  filter: blur(20px);
}

.welcome__title {
  max-width: 15ch;
  font-size: clamp(2.9rem, 8vw, 6.6rem);
  font-weight: 800;
  font-stretch: 80%;
  line-height: 0.9;
  letter-spacing: -0.04em;
}

/* The headline is spoken like a subtitle: each word lands highlighted, then settles. */
.welcome__word {
  display: inline-block;
  margin: 0 0.06em;
  padding: 0 0.05em;
  border-radius: 0.12em;
  animation:
    land 520ms cubic-bezier(0.2, 1.5, 0.4, 1) both,
    spoken 620ms linear both;
  animation-delay: calc(var(--i) * 150ms);
}

.welcome__lead {
  max-width: 50ch;
  margin-top: 1.4rem;
  font-size: clamp(1.05rem, 1.6vw, 1.25rem);
  line-height: 1.45;
  color: var(--muted);
}

.welcome__notice {
  width: min(100%, 720px);
  margin-top: 1.75rem;
  text-align: left;
}

.welcome__form {
  width: min(100%, 640px);
  margin-top: 1.75rem;
  display: grid;
  gap: 0.9rem;
}

.welcome__here {
  justify-self: start;
  font: inherit;
  font-size: var(--t-sm);
  color: var(--muted);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.welcome__here strong {
  color: var(--caption);
}

.welcome__here:hover {
  color: var(--text);
}

.fan {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: clamp(0.5rem, 2.5vw, 2rem);
  width: 100%;
  margin-top: clamp(2.5rem, 5vw, 3.5rem);
  perspective: 1400px;
}

.fan__item {
  margin: 0;
  width: min(30%, 230px);
  display: grid;
  gap: 0.9rem;
}

.fan__item[data-slot='left'] :deep(.frame) {
  transform: rotateY(18deg) rotateZ(-3deg);
  transform-origin: right center;
}

.fan__item[data-slot='right'] :deep(.frame) {
  transform: rotateY(-18deg) rotateZ(3deg);
  transform-origin: left center;
}

.fan__item[data-slot='center'] {
  width: min(34%, 265px);
  z-index: 1;
}

.fan__item figcaption {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--t-sm);
  color: var(--muted);
}

.fan__dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}

.fan__legend {
  margin-top: 1.5rem;
  font-size: var(--t-sm);
  color: var(--faint);
}

@keyframes land {
  from {
    opacity: 0;
    transform: translateY(0.35em) scale(0.8) rotate(-3deg);
  }
}

@keyframes spoken {
  0%,
  62% {
    background: var(--caption);
    color: var(--ink);
  }
  100% {
    background: transparent;
    color: inherit;
  }
}

@media (max-width: 560px) {
  .fan__item[data-slot='left'] :deep(.frame),
  .fan__item[data-slot='right'] :deep(.frame) {
    transform: none;
  }

  .fan__item figcaption {
    font-size: 0.72rem;
    line-height: 1.25;
    align-items: flex-start;
    text-align: left;
  }

  .fan__dot {
    margin-top: 0.3em;
  }
}
</style>
