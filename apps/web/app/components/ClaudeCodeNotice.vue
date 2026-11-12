<script setup lang="ts">
import type { ClaudeCodeDto } from '#shared/types/api'

/** Shown when the machine's Claude Code cannot be used yet: says exactly what to do. */
defineProps<{ claudeCode: ClaudeCodeDto }>()

const checking = ref(false)
const check = async () => {
  checking.value = true
  // The server remembers the last answer for a few seconds.
  await new Promise((resolve) => setTimeout(resolve, 600))
  await refreshNuxtData('setup')
  checking.value = false
}
</script>

<template>
  <section v-if="claudeCode.state !== 'ready'" class="notice" role="status">
    <div class="notice__text">
      <template v-if="claudeCode.state === 'missing'">
        <h2>Claude Code n'est pas installé sur cette machine.</h2>
        <p>
          repo-motion ne contient pas d'IA : il utilise votre propre Claude Code pour lire le code, avec votre
          abonnement ou votre clé. Rien ne passe par un serveur tiers.
        </p>
        <ol>
          <li>
            <a href="https://code.claude.com/docs/en/setup" target="_blank" rel="noopener">Installez Claude Code</a>.
          </li>
          <li>Connectez-le en lançant <code>claude auth login</code> dans un terminal.</li>
          <li>Revenez ici et vérifiez.</li>
        </ol>
      </template>
      <template v-else>
        <h2>Claude Code est installé, mais pas connecté.</h2>
        <p>
          Lancez cette commande dans un terminal et connectez-vous avec votre compte Claude. repo-motion ne voit jamais
          vos identifiants.
        </p>
        <p><code class="notice__command">{{ claudeCode.executable }} auth login</code></p>
        <p class="notice__version">Version détectée : {{ claudeCode.version }}</p>
      </template>
    </div>
    <UiButton variant="secondary" :loading="checking" @click="check">Vérifier à nouveau</UiButton>
  </section>
</template>

<style scoped>
.notice {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.25rem;
  padding: 1.5rem;
  border-radius: var(--r-tile);
  border: 1px solid var(--caption);
  background: var(--playhead-soft);
}

.notice__text {
  display: grid;
  gap: 0.6rem;
  max-width: 62ch;
}

.notice h2 {
  font-size: var(--t-xl);
  font-stretch: 88%;
}

.notice p,
.notice ol {
  color: var(--muted);
}

.notice ol {
  margin: 0;
  padding-left: 1.2rem;
  display: grid;
  gap: 0.3rem;
}

.notice a {
  color: var(--caption);
}

.notice code {
  color: var(--text);
  padding: 0.1em 0.4em;
  border-radius: 6px;
  background: rgb(255 255 255 / 0.08);
}

.notice__command {
  display: inline-block;
  padding: 0.45em 0.8em;
  font-size: 0.9rem;
  user-select: all;
  overflow-wrap: anywhere;
}

.notice__version {
  font-size: var(--t-xs);
}
</style>
