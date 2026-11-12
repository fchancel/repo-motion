<script setup lang="ts">
import type { PersonaDto } from '#shared/types/api'

/** One persona, in their own colour. */
const props = defineProps<{ persona: PersonaDto; hue: string }>()

const initial = computed(() => props.persona.name.trim()[0]?.toUpperCase() ?? '?')
</script>

<template>
  <article class="persona" :style="{ '--hue': hue }" :aria-label="`${persona.name}, ${persona.role}`">
    <header class="persona__identity">
      <span class="persona__avatar" aria-hidden="true">{{ initial }}</span>
      <div>
        <h2 class="persona__name">{{ persona.name }}</h2>
        <p class="persona__role">{{ persona.role }}</p>
      </div>
    </header>

    <!-- Why Claude imagined this person: their audience and the features that inspired them. -->
    <section class="persona__why">
      <h3>Pourquoi ce persona</h3>
      <p v-if="persona.rationale">{{ persona.rationale }}</p>
      <p v-else class="persona__why-missing">
        Ces personas ont été écrits avant que Claude explique ses choix. Réécrivez-les pour voir pourquoi.
      </p>
    </section>

    <div class="persona__main">
      <section aria-label="Accroche de sa vidéo">
        <h3>Son accroche</h3>
        <p class="persona__hook">{{ persona.hook }}</p>
      </section>

      <p class="persona__situation">{{ persona.situation }}</p>

      <section>
        <h3>Ce qu'elle ou il espère</h3>
        <p>{{ persona.goal }}</p>
      </section>
    </div>

    <div class="persona__side">
      <section>
        <h3>Ce qui frustre</h3>
        <ul class="persona__list">
          <li v-for="pain in persona.pains" :key="pain">{{ pain }}</li>
        </ul>
      </section>

      <section v-if="persona.objections.length">
        <h3>Ce qui retient</h3>
        <ul class="persona__list">
          <li v-for="objection in persona.objections" :key="objection">{{ objection }}</li>
        </ul>
      </section>

      <section>
        <h3>Ce qui convaincra</h3>
        <ul class="persona__chips">
          <li v-for="feature in persona.keyFeatures" :key="feature" class="persona__chip persona__chip--feature">{{ feature }}</li>
        </ul>
      </section>

      <section v-if="persona.vocabulary.length">
        <h3>Ses mots</h3>
        <ul class="persona__chips">
          <li v-for="word in persona.vocabulary" :key="word" class="persona__chip">{{ word }}</li>
        </ul>
      </section>
    </div>

    <footer class="persona__footer">
      <span class="persona__audience">{{ persona.audience }}</span>
      <ul class="persona__channels" aria-label="Où diffuser sa vidéo">
        <li v-for="channel in persona.channels" :key="channel">{{ CHANNEL_LABELS[channel] }}</li>
      </ul>
    </footer>
  </article>
</template>

<style scoped>
.persona {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  grid-template-areas:
    'identity identity'
    'why why'
    'main side'
    'footer footer';
  gap: 1.25rem 1.75rem;
  padding: 1.5rem;
  border-radius: var(--r-tile);
  border: 1px solid var(--line);
  /* Each persona lights their card with their own hue. */
  background:
    radial-gradient(70% 90% at 0% 0%, color-mix(in srgb, var(--hue) 22%, transparent), transparent 65%),
    var(--surface);
  transition: border-color 160ms;
}

.persona:hover {
  border-color: color-mix(in srgb, var(--hue) 55%, transparent);
}

.persona__identity {
  grid-area: identity;
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.persona__avatar {
  display: grid;
  place-items: center;
  width: 3.2rem;
  height: 3.2rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--hue);
  color: var(--ink);
  font-family: var(--display);
  font-weight: 800;
  font-size: 1.4rem;
}

.persona__name {
  font-size: var(--t-xl);
  font-stretch: 88%;
}

.persona__role {
  color: var(--muted);
}

.persona__why {
  grid-area: why;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  background: color-mix(in srgb, var(--hue) 9%, rgb(255 255 255 / 0.03));
  border-left: 3px solid var(--hue);
}

.persona__why p {
  max-width: 80ch;
  font-size: var(--t-sm);
}

.persona__why .persona__why-missing {
  color: var(--faint);
  font-style: italic;
}

.persona__main,
.persona__side {
  display: grid;
  gap: 1.1rem;
  align-content: start;
  min-width: 0;
}

.persona__main {
  grid-area: main;
}

.persona__side {
  grid-area: side;
}

.persona h3 {
  margin-bottom: 0.35rem;
  font-size: var(--t-xs);
  font-weight: 600;
  color: var(--muted);
}

.persona__hook {
  font-family: var(--display);
  font-weight: 750;
  font-stretch: 88%;
  font-size: var(--t-xl);
  line-height: 1.08;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.persona__situation {
  color: var(--muted);
}

.persona__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.4rem;
}

.persona__list li {
  padding-left: 0.9rem;
  border-left: 2px solid color-mix(in srgb, var(--hue) 70%, transparent);
  font-size: var(--t-sm);
}

.persona__chips,
.persona__channels {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.persona__chip {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  font-size: var(--t-xs);
  color: var(--muted);
}

.persona__chip--feature {
  border-color: transparent;
  background: color-mix(in srgb, var(--hue) 20%, transparent);
  color: var(--text);
  font-weight: 600;
}

.persona__footer {
  grid-area: footer;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
  font-size: var(--t-xs);
}

.persona__audience {
  flex: 1 1 280px;
  color: var(--faint);
}

.persona__channels li {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.07);
  font-weight: 600;
}

@media (max-width: 760px) {
  .persona {
    grid-template-columns: 1fr;
    grid-template-areas: 'identity' 'why' 'main' 'side' 'footer';
  }
}

@media (max-width: 560px) {
  .persona {
    padding: 1.1rem;
  }
}
</style>
