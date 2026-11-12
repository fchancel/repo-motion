<script setup lang="ts">
/**
 * Plays a `Reel` as a looping four-shot video, entirely in CSS: kinetic hook,
 * app demo with karaoke subtitles, benefit, call to action. It is a storyboard
 * mock-up, not a rendered video.
 */
const props = withDefaults(
  defineProps<{
    reel: Reel
    /** `loop` plays on its own, `controlled` follows `playing`, `poster` stays on the first shot. */
    mode?: 'loop' | 'controlled' | 'poster'
    playing?: boolean
    width?: string
    /** Delay before the first loop, to stagger several players. */
    delay?: number
    glow?: boolean
    safeZones?: boolean
  }>(),
  { mode: 'loop', playing: false, width: '220px', delay: 0, glow: true, safeZones: false },
)

const emit = defineEmits<{ scene: [index: number] }>()

const index = ref(0)
const running = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const scene = computed<ReelSceneKey>(() => REEL_SCENES[index.value]?.key ?? 'hook')

const schedule = () => {
  timer = setTimeout(() => {
    index.value = (index.value + 1) % REEL_SCENES.length
    emit('scene', index.value)
    schedule()
  }, REEL_SCENES[index.value]?.ms ?? 2000)
}

const start = () => {
  clearTimeout(timer)
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  running.value = true
  schedule()
}

const rewind = () => {
  clearTimeout(timer)
  running.value = false
  index.value = 0
  emit('scene', 0)
}

onMounted(() => {
  if (props.mode === 'loop') timer = setTimeout(start, props.delay)
  if (props.mode === 'controlled' && props.playing) start()
})
onBeforeUnmount(() => clearTimeout(timer))

watch(
  () => props.playing,
  (playing) => {
    if (props.mode !== 'controlled') return
    if (playing) start()
    else rewind()
  },
)

const words = (text: string) => text.split(/\s+/).filter(Boolean)
const handle = computed(() =>
  props.reel.brand
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, ''),
)
</script>

<template>
  <MotionPhoneFrame
    :brand="reel.color"
    :width="width"
    :glow="glow"
    :safe-zones="safeZones"
    :label="`Maquette de vidéo pour ${reel.brand} : ${reel.hook}`"
  >
    <div class="reel" :data-scene="scene" :style="{ '--hue': reel.color, '--ink-on-hue': readableOn(reel.color) }">
      <div class="reel__bars">
        <span v-for="(shot, i) in REEL_SCENES" :key="shot.key" class="bar">
          <span
            :key="`${i}-${index}-${running}`"
            class="bar__fill"
            :class="{ 'bar__fill--done': i < index, 'bar__fill--run': i === index && running }"
            :style="{ '--ms': `${shot.ms}ms` }"
          />
        </span>
      </div>
      <p class="reel__handle">@{{ handle }}</p>

      <div v-if="scene === 'hook'" key="hook" class="scene scene--hook">
        <p class="big" :style="{ fontSize: fitText(reel.hook, [15, 12, 9.6]) }">
          <span v-for="(word, i) in words(reel.hook)" :key="i" class="word word--flash" :style="{ '--i': i }">{{
            word
          }}</span>
        </p>
      </div>

      <div v-else-if="scene === 'demo'" key="demo" class="scene scene--demo">
        <div class="app">
          <p class="app__bar"><span class="app__logo" />{{ reel.demoTitle }}</p>
          <p v-for="(row, i) in reel.demoRows" :key="row" class="app__row" :class="{ 'app__row--pick': i === 1 }">
            <span class="app__check" />{{ row }}
          </p>
        </div>
        <p class="subtitle">
          <span v-for="(word, i) in words(reel.caption)" :key="i" class="subtitle__word" :style="{ '--i': i }">{{
            word
          }}</span>
        </p>
      </div>

      <div v-else-if="scene === 'benefit'" key="benefit" class="scene scene--benefit">
        <span class="rule" />
        <p class="big" :style="{ fontSize: fitText(reel.benefit, [14, 11, 8.6]) }">
          <span v-for="(word, i) in words(reel.benefit)" :key="i" class="word word--rise" :style="{ '--i': i }">{{
            word
          }}</span>
        </p>
      </div>

      <div v-else key="cta" class="scene scene--cta">
        <p class="brand" :style="{ fontSize: fitText(reel.brand, [22, 15, 10]) }">{{ reel.brand }}</p>
        <p class="pill">{{ reel.cta }}</p>
      </div>
    </div>
  </MotionPhoneFrame>
</template>

<style scoped>
.reel {
  --ink: var(--ink-on-hue);
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(110% 60% at 100% 0%, rgb(255 255 255 / 0.22), transparent 60%),
    var(--hue);
  color: var(--ink);
  font-family: var(--display);
}

/* A hard cut to black for the benefit shot. */
.reel[data-scene='benefit'] {
  --ink: #ffffff;
  background: #0b0b10;
}

.reel__bars {
  position: absolute;
  top: 5cqi;
  left: 6cqi;
  right: 6cqi;
  z-index: 3;
  display: flex;
  gap: 1.6cqi;
}

.bar {
  flex: 1;
  height: 1.3cqi;
  border-radius: 1cqi;
  overflow: hidden;
  background: color-mix(in srgb, var(--ink) 26%, transparent);
}

.bar__fill {
  display: block;
  width: 0;
  height: 100%;
  background: var(--ink);
}

.bar__fill--done {
  width: 100%;
}

.bar__fill--run {
  animation: fill var(--ms) linear forwards;
}

.reel__handle {
  position: absolute;
  top: 9.5cqi;
  left: 6cqi;
  z-index: 3;
  font: 600 4.6cqi var(--font);
  opacity: 0.75;
}

.scene {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24cqi 8cqi 40cqi;
}

.big {
  font-weight: 800;
  font-stretch: 88%;
  line-height: 1.02;
  letter-spacing: -0.035em;
}

.word {
  display: inline-block;
  margin-right: 0.2em;
  padding: 0 0.06em;
  border-radius: 0.14em;
  animation-delay: calc(var(--i) * 110ms);
  animation-fill-mode: both;
}

/* Each word pops in highlighted, like a karaoke caption, then settles. */
.word--flash {
  animation-name: pop, flash;
  animation-duration: 420ms, 520ms;
  animation-timing-function: cubic-bezier(0.2, 1.6, 0.4, 1), linear;
  animation-delay: calc(var(--i) * 110ms), calc(var(--i) * 110ms);
}

.word--rise {
  animation: rise 480ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
  animation-delay: calc(140ms + var(--i) * 70ms);
}

.rule {
  width: 22cqi;
  height: 2.4cqi;
  margin-bottom: 7cqi;
  border-radius: 2cqi;
  background: var(--hue);
  transform-origin: left;
  animation: grow 500ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
}

/* ── Demo shot ── */

.scene--demo {
  justify-content: flex-start;
  padding-top: 25cqi;
}

.app {
  padding: 5cqi;
  border-radius: 6cqi;
  background: #ffffff;
  color: #14141d;
  font-family: var(--font);
  box-shadow: 0 8cqi 20cqi -8cqi rgb(0 0 0 / 0.5);
  transform-origin: 50% 60%;
  animation:
    rise 560ms cubic-bezier(0.2, 0.9, 0.3, 1) both,
    zoom 4s linear both;
}

.app__bar {
  display: flex;
  align-items: center;
  gap: 2.4cqi;
  font-weight: 700;
  font-size: 5.6cqi;
}

.app__logo {
  width: 6cqi;
  height: 6cqi;
  border-radius: 1.8cqi;
  background: var(--hue);
}

.app__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2.6cqi;
  margin-top: 2.6cqi;
  padding: 3.4cqi;
  border-radius: 3.4cqi;
  background: #f0f0f5;
  font-weight: 600;
  font-size: 4.8cqi;
  line-height: 1.2;
}

.app__check {
  width: 5cqi;
  height: 5cqi;
  flex-shrink: 0;
  border-radius: 50%;
  border: 0.7cqi solid #c5c5d1;
}

.app__row--pick {
  animation: pick 260ms 1300ms both;
}

.app__row--pick .app__check {
  animation: check 260ms 1300ms both;
}

/* The tap that selects the row. */
.app__row--pick::after {
  content: '';
  position: absolute;
  right: 8cqi;
  top: 50%;
  width: 12cqi;
  height: 12cqi;
  margin-top: -6cqi;
  border-radius: 50%;
  background: color-mix(in srgb, var(--hue) 55%, transparent);
  animation: tap 700ms 950ms both;
}

.subtitle {
  position: absolute;
  left: 7cqi;
  right: 7cqi;
  bottom: 40cqi;
  text-align: center;
  font: 700 5.4cqi/1.5 var(--font);
}

.subtitle__word {
  display: inline-block;
  margin: 0.1em 0.05em;
  padding: 0.05em 0.32em;
  border-radius: 0.3em;
  background: #0b0b10;
  color: #ffffff;
  animation: speak 480ms linear both;
  animation-delay: calc(700ms + var(--i) * 190ms);
}

/* ── Call to action ── */

.scene--cta {
  align-items: center;
  gap: 8cqi;
  text-align: center;
}

.brand {
  font-weight: 800;
  font-stretch: 85%;
  line-height: 0.95;
  letter-spacing: -0.045em;
  animation: pop 520ms cubic-bezier(0.2, 1.5, 0.4, 1) both;
}

.pill {
  padding: 3cqi 7cqi;
  border-radius: 99cqi;
  background: var(--ink);
  color: var(--hue);
  font: 700 5.4cqi var(--font);
  animation:
    rise 420ms 260ms cubic-bezier(0.2, 0.9, 0.3, 1) both,
    pulse 1.1s 800ms ease-in-out infinite;
}

@keyframes fill {
  to {
    width: 100%;
  }
}

@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.55) rotate(-4deg);
  }
}

@keyframes flash {
  0%,
  70% {
    background: var(--caption);
    color: #0b0b10;
  }
  100% {
    background: transparent;
    color: inherit;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(40%);
  }
}

@keyframes grow {
  from {
    transform: scaleX(0);
  }
}

@keyframes zoom {
  to {
    scale: 1.12;
  }
}

@keyframes pick {
  to {
    background: color-mix(in srgb, var(--hue) 20%, #ffffff);
    box-shadow: inset 0 0 0 0.7cqi var(--hue);
  }
}

@keyframes check {
  to {
    background: var(--hue);
    border-color: var(--hue);
  }
}

@keyframes tap {
  0% {
    opacity: 0;
    transform: scale(0.2);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

@keyframes speak {
  0% {
    opacity: 0;
    transform: translateY(40%);
  }
  35%,
  70% {
    opacity: 1;
    transform: none;
    background: var(--caption);
    color: #0b0b10;
  }
  100% {
    opacity: 1;
    background: #0b0b10;
    color: #ffffff;
  }
}

@keyframes pulse {
  50% {
    transform: scale(1.06);
  }
}
</style>
