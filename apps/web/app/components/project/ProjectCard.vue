<script setup lang="ts">
import type { ProjectDto } from '#shared/types/api'

const props = defineProps<{ project: ProjectDto }>()

const headline = computed(() => projectHeadline(props.project))
const stages = computed(() => projectStages(props.project))
const brief = computed(() => (props.project.analysis.status === 'succeeded' ? props.project.analysis.brief : null))
const reel = computed(() => (brief.value ? reelFromBrief(brief.value) : null))
const running = computed(() => projectIsBusy(props.project))

// The preview plays while the card is hovered or focused.
const active = ref(false)
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="card"
    :style="{ '--brand': projectBrandColor(project) ?? 'transparent' }"
    @pointerenter="active = true"
    @pointerleave="active = false"
    @focus="active = true"
    @blur="active = false"
  >
    <div class="card__media">
      <MotionReelPlayer v-if="reel" :reel="reel" mode="controlled" :playing="active" width="118px" :glow="false" />
      <MotionPhoneFrame v-else width="118px" :scanning="running">
        <div class="code" aria-hidden="true">
          <span v-for="n in 12" :key="n" :style="{ width: `${30 + ((n * 37) % 60)}%`, marginLeft: `${(n % 4) * 8}%` }" />
        </div>
      </MotionPhoneFrame>
    </div>

    <div class="card__body">
      <UiStatus :tone="headline.tone" :label="headline.label" />
      <h2 class="card__title">{{ brief?.productName ?? project.folder.name }}</h2>
      <p class="card__repo mono" :title="project.folder.path">{{ project.folder.path }}</p>
      <p v-if="brief" class="card__tagline">{{ brief.tagline }}</p>

      <div class="card__footer">
        <ol class="mini-track" aria-label="Avancement">
          <li v-for="stage in stages" :key="stage.key" :data-state="stage.state" :title="`${stage.label} : ${stage.detail}`" />
        </ol>
        <span class="card__date">Ajouté {{ fromNow(project.createdAt) }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  gap: 1.4rem;
  padding: 1.25rem;
  overflow: hidden;
  border-radius: var(--r-tile);
  border: 1px solid var(--line);
  /* Each project lights its card with its own brand colour. */
  background:
    radial-gradient(90% 130% at 0% 50%, color-mix(in srgb, var(--brand) 34%, transparent), transparent 62%),
    var(--surface);
  text-decoration: none;
  transition:
    border-color 160ms,
    transform 160ms;
}

.card:hover,
.card:focus-visible {
  border-color: var(--line-strong);
  transform: translateY(-3px);
}

.card:focus-visible {
  border-radius: var(--r-tile);
}

.code {
  display: grid;
  gap: 6cqi;
  padding: 24cqi 12cqi;
}

.code span {
  height: 4cqi;
  border-radius: 3cqi;
  background: rgb(255 255 255 / 0.2);
}

.card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  padding-block: 0.25rem;
}

.card__title {
  margin-top: 0.5rem;
  font-size: 1.7rem;
  font-stretch: 88%;
  overflow-wrap: anywhere;
}

.card__repo {
  color: var(--faint);
  font-size: var(--t-xs);
  overflow-wrap: anywhere;
}

.card__tagline {
  margin-top: 0.25rem;
  color: var(--muted);
  font-size: var(--t-sm);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card__footer {
  width: 100%;
  margin-top: auto;
  padding-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem 1rem;
}

/* Story bars: one per stage. */
.mini-track {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 4px;
}

.mini-track li {
  width: 34px;
  height: 4px;
  border-radius: 2px;
  background: var(--line-strong);
}

.mini-track [data-state='done'] {
  background: var(--text);
}

.mini-track [data-state='running'] {
  background: var(--rec);
}

.mini-track [data-state='failed'] {
  background: color-mix(in srgb, var(--rec) 50%, transparent);
}

.card__date {
  font-size: var(--t-xs);
  color: var(--faint);
}
</style>
