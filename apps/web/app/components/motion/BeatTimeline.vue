<script setup lang="ts">
/** A video's structure drawn as an editor timeline: one track, clips sized by their duration. */
export interface Beat {
  label: string
  seconds: number
  text: string
}

/** `active` lights the clip currently playing in a `ReelPlayer` next to it. */
const props = defineProps<{ beats: Beat[]; active?: number }>()

const total = computed(() => props.beats.reduce((sum, beat) => sum + beat.seconds, 0))
const timecode = (seconds: number) => `00:${String(seconds).padStart(2, '0')}`
const synced = computed(() => props.active !== undefined)
</script>

<template>
  <figure class="timeline" :data-synced="synced">
    <div class="timeline__ruler" aria-hidden="true">
      <span>{{ timecode(0) }}</span>
      <span>{{ timecode(total) }}</span>
    </div>
    <div class="timeline__track" aria-hidden="true">
      <span
        v-for="(beat, index) in beats"
        :key="beat.label"
        class="timeline__clip"
        :data-hook="index === 0"
        :data-active="index === active"
        :style="{ flex: beat.seconds }"
      />
    </div>
    <figcaption>
      <ol class="timeline__legend">
        <li v-for="(beat, index) in beats" :key="beat.label" :data-hook="index === 0" :data-active="index === active">
          <span class="timeline__key" aria-hidden="true" />
          <span class="timeline__label">{{ beat.label }}</span>
          <span class="timeline__duration mono">{{ beat.seconds }} s</span>
          <span class="timeline__text">{{ beat.text }}</span>
        </li>
      </ol>
    </figcaption>
  </figure>
</template>

<style scoped>
.timeline {
  margin: 0;
  display: grid;
  gap: 0.45rem;
}

.timeline__ruler {
  display: flex;
  justify-content: space-between;
  font-family: var(--mono);
  font-size: 0.7rem;
  color: var(--faint);
}

.timeline__track {
  display: flex;
  gap: 3px;
  height: 40px;
  padding: 4px;
  border-radius: var(--r-control);
  background: var(--surface-sunken);
  border: 1px solid var(--line);
}

.timeline__clip {
  min-width: 12px;
  border-radius: 7px;
  background: var(--hue-periwinkle);
  transition:
    opacity 200ms,
    box-shadow 200ms;
}

.timeline__clip:nth-child(3) {
  background: var(--hue-mint);
}

.timeline__clip:nth-child(4) {
  background: var(--text);
}

.timeline__clip[data-hook='true'] {
  background: var(--caption);
}

[data-synced='true'] .timeline__clip {
  opacity: 0.28;
}

[data-synced='true'] .timeline__clip[data-active='true'] {
  opacity: 1;
  box-shadow: 0 0 18px -2px currentColor;
}

.timeline__legend {
  list-style: none;
  margin: 0.8rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}

.timeline__legend li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    'key label duration'
    '. text text';
  column-gap: 0.6rem;
  font-size: var(--t-sm);
  transition: opacity 200ms;
}

[data-synced='true'] .timeline__legend li {
  opacity: 0.45;
}

[data-synced='true'] .timeline__legend li[data-active='true'] {
  opacity: 1;
}

.timeline__key {
  grid-area: key;
  width: 10px;
  height: 10px;
  margin-top: 0.4em;
  border-radius: 3px;
  background: var(--hue-periwinkle);
}

.timeline__legend li:nth-child(3) .timeline__key {
  background: var(--hue-mint);
}

.timeline__legend li:nth-child(4) .timeline__key {
  background: var(--text);
}

.timeline__legend [data-hook='true'] .timeline__key {
  background: var(--caption);
}

.timeline__label {
  grid-area: label;
  font-weight: 650;
}

.timeline__duration {
  grid-area: duration;
  color: var(--faint);
}

.timeline__text {
  grid-area: text;
  color: var(--muted);
  font-size: var(--t-xs);
}
</style>
