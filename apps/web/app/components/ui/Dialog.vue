<script setup lang="ts">
/** Native <dialog>: focus trap, Escape and backdrop come for free. */
const open = defineModel<boolean>('open', { required: true })
defineProps<{ title: string; description?: string }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

watch(open, (value) => {
  if (!dialog.value) return
  if (value && !dialog.value.open) dialog.value.showModal()
  if (!value && dialog.value.open) dialog.value.close()
})

const closeOnBackdrop = (event: MouseEvent) => {
  if (event.target === dialog.value) open.value = false
}
</script>

<template>
  <dialog ref="dialog" class="dialog" :aria-labelledby="titleId" @close="open = false" @click="closeOnBackdrop">
    <div class="dialog__content">
      <header class="dialog__header">
        <h2 :id="titleId">{{ title }}</h2>
        <p v-if="description" class="dialog__description">{{ description }}</p>
      </header>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(520px, calc(100vw - 32px));
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-panel);
  background: var(--surface-raised);
  color: var(--text);
  box-shadow: 0 32px 80px -20px rgb(0 0 0 / 0.9);
}

.dialog::backdrop {
  background: rgb(5 5 8 / 0.7);
  backdrop-filter: blur(8px);
}

.dialog[open] {
  animation: enter 160ms ease-out;
}

.dialog__content {
  padding: 1.5rem;
  display: grid;
  gap: 1.25rem;
}

.dialog__header {
  display: grid;
  gap: 0.35rem;
}

.dialog__description {
  color: var(--muted);
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.99);
  }
}
</style>
