<script setup lang="ts">
/** Shown on a stage that cannot run yet because the previous one is missing. Always says what unblocks it. */
defineProps<{
  state: 'locked'
  title: string
  text: string
  /** What must happen first, when locked: its name and where to do it. */
  previous: { label: string; to: string }
}>()
</script>

<template>
  <section class="gate" :data-state="state">
    <div class="gate__text">
      <UiStatus tone="locked" :label="`Après ${previous.label}`" />
      <h2>{{ title }}</h2>
      <p>{{ text }}</p>
      <UiButton :to="previous.to" variant="secondary">Aller à : {{ previous.label }}</UiButton>
    </div>
    <div class="gate__preview">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.gate {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: clamp(1.5rem, 4vw, 3rem);
  align-items: center;
  padding: clamp(1.5rem, 4vw, 3rem);
  border: 1px solid var(--line);
  border-radius: var(--r-tile);
  background: var(--surface);
}

.gate__text {
  display: grid;
  gap: 0.9rem;
  justify-items: start;
  max-width: 48ch;
}

.gate__text h2 {
  font-size: var(--t-3xl);
  font-stretch: 85%;
}

.gate__text p {
  color: var(--muted);
}

.gate[data-state='locked'] .gate__preview {
  opacity: 0.45;
  filter: grayscale(0.6);
}

@media (max-width: 860px) {
  .gate {
    grid-template-columns: 1fr;
  }
}
</style>
