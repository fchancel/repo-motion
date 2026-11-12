<script setup lang="ts">
import type { ProductBriefDto } from '#shared/types/api'

const props = defineProps<{ brief: ProductBriefDto; completedAt: string }>()

const COLOR_NAMES = {
  primary: 'Principale',
  secondary: 'Secondaire',
  accent: 'Accent',
  background: 'Fond',
  text: 'Texte',
} as const

type ColorRole = keyof typeof COLOR_NAMES

/** Always in the same order, whatever order the model wrote them in. */
const palette = computed(() =>
  (Object.keys(COLOR_NAMES) as ColorRole[]).flatMap((role) => {
    const hex = props.brief.brand.colors[role]
    return hex ? [{ role, label: COLOR_NAMES[role], hex, ink: readableOn(hex) }] : []
  }),
)

const coreFeatures = computed(() => props.brief.features.filter((feature) => feature.importance === 'core'))
const otherFeatures = computed(() => props.brief.features.filter((feature) => feature.importance === 'secondary'))

const HUES = ['var(--hue-coral)', 'var(--hue-periwinkle)', 'var(--hue-mint)', 'var(--hue-rose)', 'var(--hue-azure)']
const hue = (index: number) => HUES[index % HUES.length]
</script>

<template>
  <article class="bento" :style="{ '--brand': brief.brand.colors.primary }">
    <section class="tile tile--identity">
      <p class="category">{{ brief.category }}</p>
      <h2 class="tagline">{{ brief.tagline }}</h2>
      <p class="summary">{{ brief.summary }}</p>
      <p class="meta">Brief rédigé par Claude {{ fromNow(completedAt) }}</p>
    </section>

    <section class="tile tile--problem" aria-labelledby="problem-title">
      <h3 id="problem-title" class="tile__title">Le problème résolu</h3>
      <p class="problem">{{ brief.problem }}</p>
    </section>

    <section class="tile tile--audiences" aria-labelledby="audiences-title">
      <h3 id="audiences-title" class="tile__title">Pour qui</h3>
      <ol class="audiences">
        <li v-for="(audience, index) in brief.audiences" :key="audience">
          <span class="audiences__dot" :style="{ background: hue(index) }" />
          {{ audience }}
        </li>
      </ol>
    </section>

    <section class="tile tile--features" aria-labelledby="features-title">
      <h3 id="features-title" class="tile__title">Fonctionnalités clés</h3>
      <ol class="features">
        <li v-for="feature in coreFeatures" :key="feature.name" class="feature">
          <h4>{{ feature.name }}</h4>
          <p>{{ feature.description }}</p>
          <p class="feature__benefit">{{ feature.userBenefit }}</p>
        </li>
      </ol>
      <details v-if="otherFeatures.length" class="more">
        <summary>{{ otherFeatures.length }} fonctionnalités secondaires</summary>
        <ul class="features features--plain">
          <li v-for="feature in otherFeatures" :key="feature.name" class="feature">
            <h4>{{ feature.name }}</h4>
            <p>{{ feature.description }}</p>
            <p class="feature__benefit">{{ feature.userBenefit }}</p>
          </li>
        </ul>
      </details>
    </section>

    <section class="tile tile--brand" aria-labelledby="brand-title">
      <h3 id="brand-title" class="tile__title">Identité visuelle</h3>
      <ul class="palette">
        <li v-for="color in palette" :key="color.role" :style="{ background: color.hex, color: color.ink }">
          <span class="palette__label">{{ color.label }}</span>
          <code>{{ color.hex }}</code>
        </li>
      </ul>
      <dl class="facts">
        <div v-if="brief.brand.fonts.length">
          <dt>Polices</dt>
          <dd>{{ brief.brand.fonts.join(', ') }}</dd>
        </div>
        <div>
          <dt>Ton</dt>
          <dd>{{ brief.brand.voice }}</dd>
        </div>
        <div v-if="brief.brand.logoPath">
          <dt>Logo</dt>
          <dd><code>{{ brief.brand.logoPath }}</code></dd>
        </div>
      </dl>
    </section>

    <section v-if="brief.userJourneys.length" class="tile tile--journeys" aria-labelledby="journeys-title">
      <h3 id="journeys-title" class="tile__title">Parcours utilisateurs</h3>
      <div v-for="journey in brief.userJourneys" :key="journey.name" class="journey">
        <h4>{{ journey.name }}</h4>
        <ol class="journey__steps">
          <li v-for="step in journey.steps" :key="step">{{ step }}</li>
        </ol>
      </div>
    </section>

    <section class="tile tile--sources" aria-labelledby="sources-title">
      <h3 id="sources-title" class="tile__title">Fichiers consultés</h3>
      <ul class="sources">
        <li v-for="path in brief.evidence" :key="path"><code>{{ path }}</code></li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 1rem;
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: var(--r-tile);
  background: var(--surface);
  border: 1px solid var(--line);
  min-width: 0;
}

.tile__title {
  font-size: var(--t-sm);
  font-weight: 600;
  color: var(--muted);
}

.tile--identity {
  grid-column: span 12;
  justify-content: center;
  padding: clamp(1.5rem, 3vw, 2.5rem);
}

.category {
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  font-size: var(--t-sm);
  font-weight: 600;
}

.tagline {
  max-width: 22ch;
  font-size: var(--t-3xl);
  font-stretch: 85%;
}

.summary {
  max-width: 64ch;
  color: var(--muted);
  font-size: 1.05rem;
}

.meta {
  color: var(--faint);
  font-size: var(--t-xs);
}

.tile--problem {
  grid-column: span 7;
}

.problem {
  font-family: var(--display);
  font-size: var(--t-lg);
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.015em;
}

.tile--audiences {
  grid-column: span 5;
}

.audiences {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
  font-weight: 600;
}

.audiences li {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.audiences__dot {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
  border-radius: 50%;
}

.tile--features {
  grid-column: span 7;
}

.features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1.25rem;
  counter-reset: feature;
}

.feature {
  position: relative;
  display: grid;
  gap: 0.2rem;
  padding-left: 2.8rem;
  counter-increment: feature;
}

.feature::before {
  content: counter(feature);
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  background: var(--caption);
  color: var(--ink);
  font-family: var(--display);
  font-weight: 800;
  font-size: var(--t-sm);
}

.features--plain .feature {
  padding-left: 0;
}

.features--plain .feature::before {
  content: none;
}

.feature h4 {
  font-size: 1.05rem;
  font-weight: 650;
}

.feature p {
  color: var(--muted);
}

.feature .feature__benefit {
  color: var(--text);
  font-style: italic;
}

.more summary {
  cursor: pointer;
  color: var(--caption);
  font-weight: 600;
  margin-bottom: 1rem;
}

.tile--brand {
  grid-column: span 5;
}

/* Swatches as tall strips: the palette is something you look at, not read. */
.palette {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  min-height: 150px;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--line-strong);
}

.palette li {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.1rem;
  padding: 0.6rem;
  font-size: var(--t-xs);
  transition: flex 220ms ease;
}

.palette li:first-child {
  flex: 2.2;
}

.palette li:hover {
  flex: 3;
}

.palette__label {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette code {
  font-size: 0.7rem;
  opacity: 0.8;
}

.facts {
  margin: 0;
  display: grid;
  gap: 0.7rem;
  font-size: var(--t-sm);
}

.facts dt {
  color: var(--muted);
}

.facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.tile--journeys {
  grid-column: span 7;
}

.journey {
  display: grid;
  gap: 0.6rem;
}

.journey h4 {
  font-weight: 650;
}

/* A journey reads like a strip of shots: numbered, left to right. */
.journey__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  counter-reset: shot;
}

.journey__steps li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--t-sm);
  padding: 0.35rem 0.85rem 0.35rem 0.4rem;
  border-radius: 999px;
  background: var(--surface-raised);
  border: 1px solid var(--line);
  counter-increment: shot;
}

.journey__steps li::before {
  content: counter(shot);
  display: grid;
  place-items: center;
  min-width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.1);
  font-size: var(--t-xs);
  font-weight: 700;
}

.tile--sources {
  grid-column: span 5;
}

.sources {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
  font-size: var(--t-sm);
  color: var(--muted);
  overflow-wrap: anywhere;
}

@media (max-width: 1000px) {
  .tile--problem,
  .tile--audiences {
    grid-column: span 6;
  }

  .tile--features,
  .tile--brand,
  .tile--journeys,
  .tile--sources {
    grid-column: span 12;
  }
}

@media (max-width: 640px) {
  .bento > .tile {
    grid-column: span 12;
  }
}
</style>
