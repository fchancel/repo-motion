<script setup lang="ts">
/**
 * A code editor being read: the "before" of every video.
 * The landing page shows a sample snippet. Inside the app, `abstract` draws anonymous
 * lines instead: we never pretend to display the user's actual files.
 */
withDefaults(defineProps<{ title?: string; abstract?: boolean }>(), {
  title: 'app/pages/planning.vue',
  abstract: false,
})

const lines = SAMPLE_CODE
const HUES = ['tag', 'key', 'fn', 'str'] as const
const skeleton = Array.from({ length: 13 }, (_, n) => ({
  indent: [0, 1, 1, 0, 0, 1, 2, 1, 0, 0, 1, 2, 0][n] ?? 0,
  bars: n === 3 || n === 9 ? [] : [18 + ((n * 23) % 30), 14 + ((n * 37) % 42)].slice(0, 1 + (n % 2)),
}))
</script>

<template>
  <figure class="window" role="img" aria-label="Extrait de code en cours de lecture">
    <figcaption class="window__bar" aria-hidden="true">
      <span class="window__dots"><i /><i /><i /></span>
      <span class="window__file">{{ title }}</span>
    </figcaption>
    <div class="window__code" aria-hidden="true">
      <template v-if="abstract">
        <div v-for="(line, n) in skeleton" :key="n" class="line line--bars" :style="{ '--n': n }">
          <span class="line__no">{{ n + 1 }}</span>
          <span class="line__indent" :style="{ width: `${line.indent * 1.2}rem` }" />
          <span
            v-for="(width, b) in line.bars"
            :key="b"
            class="line__bar"
            :class="`bar-${HUES[(n + b) % HUES.length]}`"
            :style="{ width: `${width}%` }"
          />
        </div>
      </template>
      <template v-else>
        <div v-for="(line, n) in lines" :key="n" class="line" :style="{ '--n': n }">
          <span class="line__no">{{ n + 1 }}</span>
          <span v-for="([text, kind], t) in line" :key="t" :class="kind && `tok-${kind}`">{{ text }}</span>
        </div>
      </template>
    </div>
    <span class="window__beam" aria-hidden="true" />
  </figure>
</template>

<style scoped>
.window {
  position: relative;
  margin: 0;
  overflow: hidden;
  border-radius: 14px;
  background: #0d0d14;
  border: 1px solid var(--line-strong);
  font-family: var(--mono);
  font-size: 0.74rem;
}

.window__bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid var(--line);
  color: var(--faint);
}

.window__dots {
  display: flex;
  gap: 5px;
}

.window__dots i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--line-strong);
}

.window__code {
  margin: 0;
  padding: 0.75rem 0;
  line-height: 1.75;
  color: #c9c8d6;
  overflow: hidden;
}

.line {
  min-height: 1.75em;
  padding-right: 1rem;
  white-space: pre;
  /* Each line lights up as the beam passes over it. */
  animation: read 3.9s linear infinite;
  animation-delay: calc(var(--n) * 0.3s);
}

.line__no {
  display: inline-block;
  width: 2.4rem;
  padding-right: 0.9rem;
  text-align: right;
  color: var(--faint);
  opacity: 0.6;
  user-select: none;
}

.line--bars {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.line--bars .line__no {
  flex-shrink: 0;
}

.line__indent {
  flex-shrink: 0;
  margin-right: -0.5rem;
}

.line__bar {
  height: 0.5rem;
  border-radius: 0.25rem;
  opacity: 0.75;
}

.bar-tag {
  background: #7c8cff;
}

.bar-key {
  background: #ff8f73;
}

.bar-fn {
  background: var(--caption);
}

.bar-str {
  background: #3ee6a8;
}

.tok-tag {
  color: #7c8cff;
}

.tok-key {
  color: #ff8f73;
}

.tok-fn {
  color: var(--caption);
}

.tok-str {
  color: #3ee6a8;
}

.tok-dim {
  color: var(--faint);
}

.window__beam {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  background: var(--caption);
  box-shadow: 0 0 18px 3px rgb(255 225 74 / 0.55);
  animation: scan 3.9s linear infinite;
}

@keyframes scan {
  from {
    top: 2.6rem;
  }
  to {
    top: 100%;
  }
}

@keyframes read {
  0%,
  6% {
    background: rgb(255 225 74 / 0.14);
  }
  14%,
  100% {
    background: transparent;
  }
}
</style>
