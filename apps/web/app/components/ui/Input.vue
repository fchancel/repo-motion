<script setup lang="ts">
const model = defineModel<string>({ required: true })

withDefaults(defineProps<{ mono?: boolean; invalid?: boolean }>(), { mono: false, invalid: false })
</script>

<template>
  <input v-model="model" class="input" :class="{ 'input--mono': mono }" :aria-invalid="invalid || undefined" />
</template>

<style scoped>
.input {
  width: 100%;
  font: inherit;
  color: inherit;
  background: var(--surface-sunken);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-control);
  padding: 0.7rem 0.9rem;
  transition: border-color 120ms;
}

.input::placeholder {
  color: var(--faint);
}

.input:hover {
  border-color: var(--muted);
}

.input:focus-visible {
  border-color: var(--playhead);
}

.input[aria-invalid='true'] {
  border-color: var(--rec);
}

.input--mono {
  font-family: var(--mono);
  font-size: 0.92rem;
}
</style>
