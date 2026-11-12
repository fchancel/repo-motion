<script setup lang="ts">
/** Before the first analysis: say what will happen, what it costs, and what Claude can and cannot do. */
defineProps<{ pending: boolean; folder: string; ready: boolean }>()
const emit = defineEmits<{ start: [] }>()

const reads = [
  'Les routes et les écrans',
  "Les textes de l'interface",
  'Le thème, les couleurs, les polices',
  'Le README et les modèles de données',
]
</script>

<template>
  <section class="start">
    <div class="start__text">
      <h2>Tout commence par comprendre le produit.</h2>
      <p class="lead">
        Claude Code lit ce dossier sur votre machine, en lecture seule, et rédige un brief : à quoi sert l'application,
        pour qui, et à quoi elle ressemble. Ce brief nourrit ensuite les personas et les vidéos.
      </p>
      <ul class="reads">
        <li v-for="item in reads" :key="item">{{ item }}</li>
      </ul>
      <div class="start__actions">
        <UiButton size="lg" :loading="pending" :disabled="!ready" @click="emit('start')">Lancer l'analyse</UiButton>
        <span class="start__note">Quelques minutes. L'analyse utilise votre Claude Code, donc votre abonnement.</span>
      </div>
    </div>

    <MotionCodeWindow class="start__code" abstract :title="folder" />
  </section>
</template>

<style scoped>
.start {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(1.5rem, 5vw, 4rem);
  padding: clamp(1.5rem, 4vw, 3rem);
  overflow: hidden;
  border-radius: var(--r-tile);
  border: 1px solid var(--line);
  background:
    radial-gradient(60% 90% at 100% 100%, rgb(255 225 74 / 0.1), transparent 70%),
    var(--surface);
}

.start__text {
  display: grid;
  gap: 1.25rem;
}

.start__text h2 {
  max-width: 14ch;
  font-size: var(--t-3xl);
  font-stretch: 85%;
}

.lead {
  max-width: 50ch;
  color: var(--muted);
  font-size: 1.05rem;
}

.reads {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 1.5rem;
  font-size: var(--t-sm);
}

.reads li {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
}

.reads li::before {
  content: '';
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--caption);
}

.start__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding-top: 0.5rem;
}

.start__note {
  color: var(--muted);
  font-size: var(--t-sm);
  max-width: 34ch;
}

.start__code {
  transform: rotate(-1.5deg);
  box-shadow: 0 30px 60px -30px rgb(0 0 0 / 0.9);
}

@media (max-width: 820px) {
  .start {
    grid-template-columns: 1fr;
  }

  .start__code {
    transform: none;
  }

  .reads {
    grid-template-columns: 1fr;
  }
}
</style>
