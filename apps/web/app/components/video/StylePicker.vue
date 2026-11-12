<script setup lang="ts">
import type { PersonaStyleDto, VideoStyleDto } from '#shared/types/api'

/**
 * The style of one persona's next videos: its look, its tone, its sound. It starts as
 * what Claude proposed for that persona, and every part of it can be changed.
 */
const props = defineProps<{
  entry: PersonaStyleDto
  /** The project has an audio file: "your own music" can be chosen. */
  hasTrack: boolean
}>()

const emit = defineEmits<{
  /** The user picked something. */
  choose: [style: VideoStyleDto]
  /** Back to what Claude proposed. */
  reset: []
  /** Give every persona this style. */
  everyone: []
}>()

const set = (change: Partial<VideoStyleDto>) => emit('choose', { ...props.entry.style, ...change })

const look = computed(() => LOOK_OPTIONS.find((option) => option.value === props.entry.style.look))
const tone = computed(() => TONE_OPTIONS.find((option) => option.value === props.entry.style.tone))
const group = useId()
</script>

<template>
  <div class="picker">
    <div class="picker__looks" role="radiogroup" aria-label="Direction artistique">
      <label v-for="option in LOOK_OPTIONS" :key="option.value" class="picker__look" :title="`${option.label} : ${option.text}`">
        <input
          type="radio"
          class="sr-only"
          :name="`${group}-look`"
          :value="option.value"
          :checked="entry.style.look === option.value"
          @change="set({ look: option.value })"
        />
        <VideoLookSwatch :look="option.value" />
        <span class="sr-only">{{ option.label }}</span>
      </label>
    </div>
    <p class="picker__chosen">
      <strong>{{ look?.label }}</strong>
      {{ look?.text }}
    </p>

    <div class="picker__selects">
      <label>
        <span>Ton</span>
        <select :value="entry.style.tone" @change="set({ tone: ($event.target as HTMLSelectElement).value as VideoStyleDto['tone'] })">
          <option v-for="option in TONE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <label>
        <span>Son</span>
        <select :value="entry.style.sound" @change="set({ sound: ($event.target as HTMLSelectElement).value as VideoStyleDto['sound'] })">
          <option v-for="option in SOUND_OPTIONS" :key="option.value" :value="option.value" :disabled="option.value === 'track' && !hasTrack">
            {{ option.label }}{{ option.value === 'track' && !hasTrack ? ' (fichier à indiquer plus haut)' : '' }}
          </option>
        </select>
      </label>
    </div>
    <p class="picker__tone">{{ tone?.text }}</p>

    <p class="picker__source">
      <template v-if="entry.suggestion && !entry.chosen">
        <span class="picker__badge">Proposé par Claude</span>
        {{ entry.suggestion.reason }}
      </template>
      <template v-else-if="entry.suggestion">
        <span class="picker__badge picker__badge--own">Votre choix</span>
        <button type="button" class="picker__link" @click="emit('reset')">
          Revenir à la proposition de Claude ({{ styleSummary(entry.suggestion) }})
        </button>
      </template>
      <template v-else>
        <span class="picker__badge picker__badge--own">{{ entry.chosen ? 'Votre choix' : 'Style par défaut' }}</span>
        Claude n'a pas encore proposé de style pour ce persona.
      </template>
      <button type="button" class="picker__link" @click="emit('everyone')">Appliquer ce style à tous les personas</button>
    </p>
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  gap: 0.6rem;
}

.picker__looks {
  display: grid;
  grid-template-columns: repeat(11, minmax(0, 1fr));
  gap: 0.35rem;
  max-width: 34rem;
}

.picker__look {
  aspect-ratio: 3 / 4;
  border-radius: 8px;
  outline: 2px solid transparent;
  outline-offset: 2px;
  cursor: pointer;
  transition: outline-color 120ms;
}

.picker__look:hover {
  outline-color: var(--line-strong);
}

.picker__look:has(input:checked) {
  outline-color: var(--caption);
}

.picker__look:has(input:focus-visible) {
  box-shadow: var(--focus);
}

.picker__chosen {
  color: var(--muted);
  font-size: var(--t-sm);
}

.picker__chosen strong {
  margin-right: 0.4rem;
  color: var(--text);
  font-family: var(--display);
  font-size: var(--t-md);
}

.picker__selects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
}

.picker__selects label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--t-sm);
  color: var(--muted);
}

.picker__selects select {
  padding: 0.4rem 0.6rem;
  border-radius: var(--r-control);
  border: 1px solid var(--line-strong);
  background: var(--surface-sunken);
  color: var(--text);
  font: inherit;
  font-size: var(--t-sm);
}

.picker__selects select:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.picker__tone {
  color: var(--faint);
  font-size: var(--t-xs);
}

.picker__source {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.8rem;
  max-width: 68ch;
  font-size: var(--t-sm);
  color: var(--muted);
}

.picker__badge {
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: var(--playhead-soft);
  color: var(--caption);
  font-size: var(--t-xs);
  font-weight: 600;
  white-space: nowrap;
}

.picker__badge--own {
  background: var(--surface-raised);
  color: var(--text);
}

.picker__link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: var(--line-strong);
  text-underline-offset: 3px;
  cursor: pointer;
}

.picker__link:hover {
  text-decoration-color: var(--caption);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 560px) {
  .picker__looks {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>
