<script setup lang="ts">
/** Elapsed time since `since`, as a timecode (00:02:14). Ticks every second on the client. */
const props = defineProps<{ since: string }>()

// Null until mounted: the server and the browser would not agree on the current second.
const now = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  now.value = Date.now()
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(timer))

const pad = (value: number) => String(value).padStart(2, '0')

const timecode = computed(() => {
  if (now.value === null) return '--:--:--'
  const seconds = Math.max(0, Math.floor((now.value - new Date(props.since).getTime()) / 1000))
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
})
</script>

<template>
  <time class="timecode" :datetime="since">{{ timecode }}</time>
</template>

<style scoped>
.timecode {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
</style>
