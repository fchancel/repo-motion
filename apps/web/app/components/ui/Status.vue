<script setup lang="ts">
import type { StatusTone } from '~/utils/status'

/** `rec` = running right now (pulsing red dot, like a camera recording). */
defineProps<{ tone: StatusTone; label: string }>()
</script>

<template>
  <span class="status" :data-tone="tone">
    <span class="status__dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--t-xs);
  font-weight: 600;
  padding: 0.22rem 0.6rem 0.22rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
  color: var(--muted);
  background: rgb(255 255 255 / 0.07);
}

.status__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

[data-tone='rec'] {
  color: var(--rec);
  background: var(--rec-soft);
}

[data-tone='rec'] .status__dot {
  animation: rec 1.4s ease-in-out infinite;
}

[data-tone='ok'] {
  color: var(--ok);
  background: var(--ok-soft);
}

[data-tone='fail'] {
  color: var(--rec);
  background: transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rec) 35%, transparent);
}

[data-tone='locked'] {
  color: var(--faint);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--line);
}

[data-tone='locked'] .status__dot {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px currentColor;
}

@keyframes rec {
  50% {
    opacity: 0.2;
  }
}
</style>
