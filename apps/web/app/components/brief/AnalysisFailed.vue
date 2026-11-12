<script setup lang="ts">
withDefaults(defineProps<{ reason: string; failedAt: string; pending: boolean; title?: string; retryLabel?: string }>(), {
  title: "L'analyse n'a pas abouti",
  retryLabel: "Relancer l'analyse",
})
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="failed" role="alert">
    <div class="failed__text">
      <h2>{{ title }}</h2>
      <p class="reason">{{ reason }}</p>
      <p class="meta">Arrêtée {{ fromNow(failedAt) }}.</p>
    </div>
    <div class="failed__actions">
      <UiButton :loading="pending" @click="emit('retry')">{{ retryLabel }}</UiButton>
    </div>
  </section>
</template>

<style scoped>
.failed {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: clamp(1.5rem, 3vw, 2.25rem);
  background:
    radial-gradient(60% 120% at 0% 0%, rgb(255 82 71 / 0.16), transparent 70%),
    var(--surface);
  border: 1px solid color-mix(in srgb, var(--rec) 45%, transparent);
  border-radius: var(--r-tile);
}

.failed__text {
  display: grid;
  gap: 0.5rem;
  max-width: 64ch;
}

.failed__text h2 {
  font-size: var(--t-2xl);
  font-stretch: 85%;
}

.reason {
  font-size: 1.1rem;
  white-space: pre-line;
}

.meta {
  color: var(--muted);
  font-size: var(--t-sm);
}

.failed__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
