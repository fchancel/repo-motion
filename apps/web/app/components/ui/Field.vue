<script setup lang="ts">
/** Label + control + hint/error. The slot receives the ids to wire `aria-describedby`. */
defineProps<{ label: string; hint?: string; error?: string | null }>()

const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`
</script>

<template>
  <div class="field">
    <label :for="id" class="field__label">{{ label }}</label>
    <slot :id="id" :described-by="[hint ? hintId : '', error ? errorId : ''].join(' ').trim() || undefined" :invalid="Boolean(error)" />
    <p v-if="error" :id="errorId" class="field__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" class="field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: 0.4rem;
}

.field__label {
  font-weight: 600;
  font-size: var(--t-sm);
}

.field__hint {
  color: var(--muted);
  font-size: var(--t-sm);
}

.field__error {
  color: var(--rec);
  font-size: var(--t-sm);
}
</style>
