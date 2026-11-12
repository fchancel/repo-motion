<script setup lang="ts">
/**
 * The project's production timeline. Each stage is a clip on one track, and also the
 * navigation between the project's pages: the current page is where the playhead sits.
 */
defineProps<{ stages: Stage[]; current: StageKey }>()
</script>

<template>
  <nav class="track" aria-label="Étapes du projet">
    <ol class="track__clips">
      <li v-for="(stage, index) in stages" :key="stage.key" class="track__item">
        <!-- `custom`: the track decides which clip is current, not the router's prefix matching. -->
        <NuxtLink v-slot="{ href, navigate }" :to="stage.path" custom>
          <a
            :href="href || undefined"
            class="clip"
            :data-state="stage.state"
            :aria-current="stage.key === current ? 'page' : undefined"
            :class="{ 'clip--current': stage.key === current }"
            @click="navigate"
          >
            <span class="clip__index">{{ index + 1 }}</span>
            <span class="clip__text">
              <span class="clip__label">{{ stage.label }}</span>
              <span class="clip__detail">{{ stage.detail }}</span>
            </span>
            <span class="clip__fill" aria-hidden="true" />
          </a>
        </NuxtLink>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.track__clips {
  list-style: none;
  margin: 0;
  padding: 5px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  background: rgb(13 13 20 / 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid var(--line);
  border-radius: 999px;
}

.clip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1.1rem 0.6rem 0.7rem;
  border-radius: 999px;
  text-decoration: none;
  color: var(--muted);
  overflow: hidden;
  isolation: isolate;
  transition: background-color 120ms;
}

.clip:hover {
  background: color-mix(in srgb, var(--line) 50%, transparent);
}

.clip--current {
  background: var(--surface-raised);
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.clip--current:hover {
  background: var(--surface-raised);
}

.clip__index {
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 50%;
  font-size: var(--t-xs);
  font-weight: 700;
  border: 1.5px solid currentColor;
  flex-shrink: 0;
}

.clip__text {
  display: grid;
  min-width: 0;
}

.clip__label {
  font-weight: 650;
  color: inherit;
}

.clip__detail {
  font-size: var(--t-xs);
  color: var(--faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The bottom edge of each clip is its progress bar. */
.clip__fill {
  position: absolute;
  left: 14%;
  right: 14%;
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  z-index: -1;
}

[data-state='done'] .clip__index {
  background: var(--ok);
  border-color: var(--ok);
  color: var(--ink);
}

[data-state='done'] .clip__fill {
  background: var(--ok);
}

[data-state='running'] .clip__index {
  color: var(--rec);
}

[data-state='running'] .clip__detail {
  color: var(--rec);
}

[data-state='running'] .clip__fill {
  background: linear-gradient(90deg, var(--rec) 0 40%, transparent 40%);
  background-size: 250% 100%;
  animation: progress 1.6s linear infinite;
}

[data-state='failed'] .clip__index,
[data-state='failed'] .clip__detail {
  color: var(--rec);
}

[data-state='locked'] {
  color: var(--faint);
}

[data-state='locked'] .clip__index {
  border-style: dashed;
}

@keyframes progress {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -150% 0;
  }
}

@media (max-width: 640px) {
  .track__clips {
    border-radius: var(--r-panel);
  }

  .clip {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.6rem 0.7rem;
    border-radius: 14px;
  }

  .clip__detail {
    display: none;
  }
}
</style>
