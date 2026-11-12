<script setup lang="ts">
import type { LookDto } from '#shared/types/api'

/**
 * A thumbnail of an art direction, in the product's own colours. The colours come from
 * `--brand`, `--brand-bg`, `--brand-second` and `--brand-third`, set by the page.
 */
defineProps<{ look: LookDto }>()
</script>

<template>
  <span class="swatch" aria-hidden="true">
    <span class="swatch__face" :data-look="look">
      <span class="swatch__line" style="width: 62%" />
      <span class="swatch__line" style="width: 84%" />
      <span class="swatch__line swatch__line--strong" style="width: 50%" />
    </span>
  </span>
</template>

<style scoped>
/* Everything inside is sized from the swatch's width, so it reads the same small or large. */
.swatch {
  display: block;
  width: 100%;
  height: 100%;
  container-type: inline-size;
}

.swatch__face {
  position: relative;
  display: grid;
  align-content: center;
  gap: 5cqi;
  width: 100%;
  height: 100%;
  padding: 0 14%;
  border-radius: 8cqi;
  overflow: hidden;
}

.swatch__line {
  height: 7cqi;
  border-radius: 1.5cqi;
  background: #ffffff;
}

.swatch__face[data-look='brand'] {
  background:
    radial-gradient(90% 70% at 20% 25%, color-mix(in srgb, var(--brand) 55%, transparent), transparent 70%),
    var(--brand-bg);
}

.swatch__face[data-look='brand'] .swatch__line--strong,
.swatch__face[data-look='terminal'] .swatch__line--strong,
.swatch__face[data-look='cinema'] .swatch__line--strong {
  background: var(--brand);
}

.swatch__face[data-look='impact'] {
  background:
    repeating-linear-gradient(-28deg, rgb(0 0 0 / 0.1) 0 6px, transparent 6px 20px),
    var(--brand-second);
}

.swatch__face[data-look='impact'] .swatch__line {
  height: 10cqi;
  border-radius: 0;
  background: #0b0b10;
}

.swatch__face[data-look='minimal'] {
  background:
    linear-gradient(rgb(0 0 0 / 0.06) 1px, transparent 1px) 0 0 / 100% 14px,
    #f5f5f2;
}

.swatch__face[data-look='minimal'] .swatch__line {
  height: 4.5cqi;
  background: #101014;
}

.swatch__face[data-look='minimal'] .swatch__line--strong,
.swatch__face[data-look='editorial'] .swatch__line--strong {
  background: color-mix(in srgb, var(--brand) 60%, #101014);
}

.swatch__face[data-look='neon'] {
  background: #04040a;
}

.swatch__face[data-look='neon'] .swatch__line {
  height: 5cqi;
  box-shadow: 0 0 8px #ffffff;
}

.swatch__face[data-look='neon'] .swatch__line--strong {
  background: var(--brand);
  box-shadow:
    0 0 6px var(--brand),
    0 0 16px var(--brand);
}

.swatch__face[data-look='gradient'] {
  background: linear-gradient(135deg, var(--brand), var(--brand-second) 55%, var(--brand-third));
}

.swatch__face[data-look='gradient'] .swatch__line,
.swatch__face[data-look='pop'] .swatch__line {
  background: #101014;
}

.swatch__face[data-look='editorial'] {
  background: #faf7f2;
  border-top: 3px double #101014;
}

.swatch__face[data-look='editorial'] .swatch__line {
  height: 6cqi;
  background: #101014;
}

.swatch__face[data-look='editorial'] .swatch__line--strong {
  transform: skewX(-18deg);
}

.swatch__face[data-look='terminal'] {
  background: #0a0d0c;
  box-shadow: inset 0 12cqi 0 rgb(255 255 255 / 0.08);
}

.swatch__face[data-look='terminal'] .swatch__line {
  height: 6cqi;
  border-radius: 0;
  background: #e3ebe6;
}

.swatch__face[data-look='pop'] {
  background:
    radial-gradient(rgb(0 0 0 / 0.12) 2px, transparent 2.5px) 0 0 / 14px 14px,
    color-mix(in srgb, var(--brand) 28%, #ffffff);
}

.swatch__face[data-look='pop'] .swatch__line--strong {
  height: 10cqi;
  border-radius: 3cqi;
  background: var(--brand);
  border: 2px solid #101014;
  box-shadow: 2px 2px 0 #101014;
  transform: rotate(-3deg);
}

.swatch__face[data-look='cinema'] {
  background: #000000 radial-gradient(80% 60% at 50% 45%, rgb(255 255 255 / 0.14), transparent);
  box-shadow:
    inset 0 13cqi 0 #000000,
    inset 0 14cqi 0 rgb(255 255 255 / 0.2),
    inset 0 -13cqi 0 #000000,
    inset 0 -14cqi 0 rgb(255 255 255 / 0.2);
}

.swatch__face[data-look='cinema'] .swatch__line {
  height: 3.5cqi;
  border-radius: 0;
  background: #f1ede6;
}

.swatch__face[data-look='retro'] {
  background:
    repeating-conic-gradient(from 0deg at 50% 100%, color-mix(in srgb, var(--brand) 35%, transparent) 0deg 12deg, transparent 12deg 24deg),
    #f4ead7;
}

.swatch__face[data-look='retro'] .swatch__line {
  height: 8cqi;
  border-radius: 0;
  background: #2b1d16;
}

.swatch__face[data-look='retro'] .swatch__line--strong {
  background: color-mix(in srgb, var(--brand) 70%, #2b1d16);
  box-shadow: 2px 2px 0 #2b1d16;
}

.swatch__face[data-look='collage'] {
  background:
    linear-gradient(8deg, transparent 58%, color-mix(in srgb, var(--brand-second) 70%, #efe6d5) 58% 100%),
    #efe6d5;
}

.swatch__face[data-look='collage'] .swatch__line {
  height: 8cqi;
  border-radius: 1cqi;
  background: #1d1a16;
}

.swatch__face[data-look='collage'] .swatch__line:nth-child(1) {
  transform: rotate(-4deg);
}

.swatch__face[data-look='collage'] .swatch__line:nth-child(2) {
  transform: rotate(2deg);
}

.swatch__face[data-look='collage'] .swatch__line--strong {
  height: 12cqi;
  background: var(--brand);
  transform: rotate(-6deg);
  clip-path: polygon(0 12%, 100% 0, 96% 100%, 4% 88%);
}
</style>
