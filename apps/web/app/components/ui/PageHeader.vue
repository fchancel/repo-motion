<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__text">
      <slot name="before" />
      <h1>
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="description" class="page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem 2rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: var(--t-3xl);
  font-stretch: 85%;
}

.page-header__text {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
}

.page-header__description {
  color: var(--muted);
  max-width: 60ch;
}

.page-header__actions {
  display: flex;
  gap: 0.5rem;
}
</style>
