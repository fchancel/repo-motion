<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    to?: RouteLocationRaw
    href?: string
    type?: 'button' | 'submit'
    loading?: boolean
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)

const tag = computed(() => (props.to ? resolveComponent('NuxtLink') : props.href ? 'a' : 'button'))
const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :href="href"
    :type="to || href ? undefined : type"
    :disabled="tag === 'button' ? isDisabled : undefined"
    :aria-busy="loading || undefined"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block }]"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <slot />
  </component>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font: inherit;
  font-weight: 650;
  line-height: 1.2;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 140ms,
    border-color 140ms,
    color 140ms,
    box-shadow 140ms,
    transform 140ms;
}

.btn:focus-visible {
  border-radius: 999px;
}

.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.btn[aria-busy='true'] {
  cursor: progress;
}

.btn--sm {
  font-size: var(--t-sm);
  padding: 0.45rem 0.9rem;
}

.btn--md {
  padding: 0.65rem 1.15rem;
}

.btn--lg {
  font-size: 1.1rem;
  padding: 0.95rem 1.7rem;
}

.btn--block {
  width: 100%;
}

.btn--primary {
  background: var(--playhead);
  color: var(--on-playhead);
}

.btn--primary:hover:not(:disabled) {
  background: var(--playhead-hover);
  box-shadow: 0 0 28px -4px rgb(255 225 74 / 0.6);
}

.btn--secondary {
  background: rgb(255 255 255 / 0.06);
  color: var(--text);
  border-color: var(--line-strong);
}

.btn--secondary:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.12);
}

.btn--ghost {
  background: transparent;
  color: var(--muted);
}

.btn--ghost:hover:not(:disabled) {
  color: var(--text);
  background: rgb(255 255 255 / 0.07);
}

.btn--danger {
  background: transparent;
  color: var(--rec);
  border-color: color-mix(in srgb, var(--rec) 40%, transparent);
}

.btn--danger:hover:not(:disabled) {
  background: var(--rec-soft);
}

.btn__spinner {
  width: 0.9em;
  height: 0.9em;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(1turn);
  }
}
</style>
