<script setup lang="ts">
/**
 * The signature object: a 9:16 vertical frame, the format every video ends up in.
 * Everything inside is sized in `cqi`, so a frame reads the same at any width.
 */
const props = withDefaults(
  defineProps<{
    brand?: string | null
    /** `solid` fills the screen with the brand colour, like a video poster. */
    fill?: 'tint' | 'solid'
    width?: string
    /** Hatches the areas TikTok and Reels cover with their own buttons. */
    safeZones?: boolean
    /** Sweeps a beam across the screen while Claude reads the code. */
    scanning?: boolean
    /** Lets the screen light the stage behind it. */
    glow?: boolean
    label?: string
  }>(),
  { brand: null, fill: 'tint', width: '180px', safeZones: false, scanning: false, glow: false, label: undefined },
)

const style = computed(() => ({
  '--frame-width': props.width,
  '--brand': props.brand ?? 'var(--faint)',
  ...(props.fill === 'solid' && props.brand ? { '--screen': props.brand, '--screen-text': readableOn(props.brand) } : {}),
}))
</script>

<template>
  <figure
    class="frame"
    :class="{ 'frame--solid': fill === 'solid' && brand }"
    :style="style"
    :aria-label="label"
    :role="label ? 'img' : undefined"
  >
    <span v-if="glow" class="frame__glow" aria-hidden="true" />
    <div class="frame__bezel">
      <div class="frame__screen">
        <slot />
        <div v-if="safeZones" class="frame__safe" aria-hidden="true">
          <span class="frame__safe-bottom" />
          <span class="frame__safe-side" />
        </div>
        <div v-if="scanning" class="frame__beam" aria-hidden="true" />
      </div>
    </div>
  </figure>
</template>

<style scoped>
.frame {
  position: relative;
  isolation: isolate;
  margin: 0;
  width: var(--frame-width);
  aspect-ratio: 9 / 16;
  flex-shrink: 0;
  container-type: inline-size;
}

.frame__glow {
  position: absolute;
  inset: 12% 4% 4%;
  z-index: -1;
  border-radius: 50%;
  background: var(--brand);
  filter: blur(22cqi);
  opacity: 0.55;
}

.frame__bezel {
  height: 100%;
  padding: 3cqi;
  border-radius: 15cqi;
  background: #020204;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.16),
    0 12cqi 30cqi -14cqi rgb(0 0 0 / 0.9);
}

.frame__screen {
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: 12.4cqi;
  background: color-mix(in srgb, var(--brand) 18%, #14141d);
  color: var(--text);
  container-type: inline-size;
}

.frame--solid .frame__screen {
  background:
    radial-gradient(120% 70% at 100% 0%, rgb(255 255 255 / 0.2), transparent 60%),
    var(--screen);
  color: var(--screen-text);
}

.frame__safe {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}

.frame__safe span {
  position: absolute;
  background: repeating-linear-gradient(-45deg, rgb(255 82 71 / 0.38) 0 1.6cqi, transparent 1.6cqi 3.6cqi);
  outline: 1px dashed rgb(255 82 71 / 0.7);
}

.frame__safe-bottom {
  left: 0;
  right: 0;
  bottom: 0;
  height: 20%;
}

.frame__safe-side {
  right: 0;
  top: 38%;
  bottom: 20%;
  width: 16%;
}

.frame__beam {
  position: absolute;
  left: 0;
  right: 0;
  top: -30%;
  height: 30%;
  z-index: 3;
  background: linear-gradient(to bottom, transparent, rgb(255 225 74 / 0.22) 85%, var(--caption) 100%);
  animation: sweep 2.4s cubic-bezier(0.6, 0, 0.4, 1) infinite;
}

@keyframes sweep {
  to {
    top: 100%;
  }
}
</style>
