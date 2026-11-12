<script setup lang="ts">
/** The application shell: one floating bar above the stage. */
const { claudeCode } = useSetup()

const STATUS = {
  ready: { tone: 'ok', label: 'Claude Code prêt' },
  signed_out: { tone: 'fail', label: 'Claude Code non connecté' },
  missing: { tone: 'fail', label: 'Claude Code introuvable' },
} as const

const status = computed(() => (claudeCode.value ? STATUS[claudeCode.value.state] : null))
</script>

<template>
  <div class="shell">
    <header class="bar">
      <NuxtLink to="/" class="bar__logo" aria-label="repo-motion, vos projets"><AppLogo /></NuxtLink>
      <span class="bar__tag">Local. Votre code ne quitte pas cette machine.</span>
      <UiStatus v-if="status" class="bar__status" :tone="status.tone" :label="status.label" />
    </header>

    <main class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  /* The stage lights spill past the content column: never let them create a scrollbar. */
  overflow-x: clip;
}

.bar {
  position: sticky;
  top: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 1rem;
  max-width: 1240px;
  margin: 12px auto 0;
  width: calc(100% - 24px);
  padding: 0.5rem 0.7rem 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: rgb(18 18 26 / 0.72);
  backdrop-filter: blur(18px) saturate(1.5);
}

.bar__logo {
  display: flex;
  text-decoration: none;
}

.bar__tag {
  color: var(--faint);
  font-size: var(--t-sm);
}

.bar__status {
  margin-left: auto;
}

.content {
  position: relative;
  isolation: isolate;
  max-width: 1240px;
  margin: 0 auto;
  padding: 3rem clamp(16px, 3vw, 2rem) 5rem;
}

@media (max-width: 720px) {
  .bar__tag {
    display: none;
  }

  .content {
    padding-top: 2rem;
  }
}
</style>
