<script setup lang="ts">
import type { VideoSetupDto } from '#shared/types/api'

/**
 * What all the project's videos share, because it belongs to the product and not to a
 * persona: how the application is shown, and the user's own music. Saved as it is filled in.
 */
const props = defineProps<{ projectId: string; setup: VideoSetupDto }>()

const { save, saving, saved, error } = useVideoSetup(() => props.projectId)

const production = ref(props.setup.production)
const demo = ref(props.setup.demo.mode)
// Each way of showing the application keeps what was typed for it.
const home = ref(props.setup.demo.mode === 'auto' ? (props.setup.demo.addresses[0] ?? '') : '')
const pages = ref(props.setup.demo.mode === 'pages' ? props.setup.demo.addresses.join('\n') : '')
const track = ref(props.setup.track ?? '')

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const addresses = computed(() => (demo.value === 'auto' ? lines(home.value).slice(0, 1) : demo.value === 'pages' ? lines(pages.value) : []))

/** A half-filled choice is not sent: the form says what is missing instead. */
const missing = computed(() => {
  if (demo.value === 'auto' && addresses.value.length === 0) return 'Indiquez l’adresse où tourne votre application.'
  if (demo.value === 'pages' && addresses.value.length === 0) return 'Indiquez au moins une page à montrer.'
  return null
})

const submit = () => {
  if (missing.value) return
  void save({ production: production.value, demo: { mode: demo.value, addresses: addresses.value }, track: track.value.trim() || null })
}

// A choice made with one click is saved at once; a typed one when the field is left.
watch([production, demo], submit)
</script>

<template>
  <section class="setup" aria-labelledby="setup-title">
    <header class="setup__header">
      <div>
        <h2 id="setup-title">Réglages communs</h2>
        <p>Ce qui vaut pour toutes les vidéos du projet. Le style, lui, se choisit persona par persona, plus bas.</p>
      </div>
      <p class="setup__state" role="status">
        <span v-if="error" class="setup__error">{{ error }}</span>
        <span v-else-if="missing" class="setup__error">{{ missing }}</span>
        <span v-else-if="saving">Enregistrement…</span>
        <span v-else-if="saved">Réglages enregistrés</span>
      </p>
    </header>

    <fieldset class="group">
      <legend>Fabrication</legend>
      <div class="makes">
        <label v-for="option in PRODUCTION_OPTIONS" :key="option.value" class="make">
          <input v-model="production" type="radio" name="production" :value="option.value" />
          <span class="choice__label">{{ option.label }}</span>
          <span class="choice__text">{{ option.text }}</span>
        </label>
      </div>
    </fieldset>

    <div class="setup__pair">
      <fieldset class="group">
        <legend>Montrer la vraie application</legend>
        <div class="choices">
          <label v-for="option in DEMO_OPTIONS" :key="option.value" class="choice">
            <input v-model="demo" type="radio" name="demo" :value="option.value" />
            <span class="choice__label">{{ option.label }}</span>
            <span class="choice__text">{{ option.text }}</span>
          </label>
        </div>

        <template v-if="demo !== 'none'">
          <div v-if="demo === 'auto'" class="field">
            <label for="demo-home">Adresse où tourne votre application</label>
            <input id="demo-home" v-model="home" type="text" spellcheck="false" placeholder="http://localhost:5173" @change="submit" />
            <p class="field__hint">
              Claude choisit jusqu'à 3 pages qui existent dans le code et s'ouvrent sans compte. Comptez environ une minute de
              plus par vidéo.
            </p>
          </div>
          <div v-else class="field">
            <label for="demo-pages">Liens des pages à montrer, un par ligne (3 au plus)</label>
            <textarea
              id="demo-pages"
              v-model="pages"
              rows="3"
              spellcheck="false"
              placeholder="http://localhost:5173&#10;http://localhost:5173/tarifs"
              @change="submit"
            />
          </div>

          <div class="note">
            <p class="note__title">Votre application doit tourner sur cet ordinateur</p>
            <ol>
              <li>
                Lancez-la comme pour développer (<code>npm run dev</code>, par exemple) et notez l'adresse qu'elle affiche,
                du type <code>http://localhost:5173</code>.
              </li>
              <li>Laissez-la ouverte pendant toute la génération : elle est filmée à ce moment-là, pas avant.</li>
              <li>
                Elle est vue comme par un visiteur qui vient d'arriver, sur un écran de téléphone : sans compte connecté, sans
                données saisies.
              </li>
            </ol>
            <p>Si elle ne répond pas, la vidéo s'arrête tout de suite en vous le disant, avant d'avoir sollicité Claude.</p>
          </div>
        </template>
      </fieldset>

      <fieldset class="group">
        <legend>Votre musique</legend>
        <div class="field">
          <label for="sound-track">Fichier audio de votre ordinateur (mp3, wav, m4a ou aac)</label>
          <input id="sound-track" v-model="track" type="text" spellcheck="false" placeholder="~/Music/mon-son.mp3" @change="submit" />
          <p class="field__hint">
            Facultatif. Il est joué dans les vidéos des personas dont le son est « Votre musique ». Assurez-vous d'avoir le
            droit de l'utiliser sur les plateformes.
          </p>
        </div>
      </fieldset>
    </div>
  </section>
</template>

<style scoped>
.setup {
  display: grid;
  gap: 1.5rem;
  padding: clamp(1.25rem, 3vw, 2.25rem);
  border-radius: var(--r-tile);
  border: 1px solid var(--line);
  background: var(--surface);
}

.setup__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: end;
  gap: 0.75rem 2rem;
}

.setup__header h2 {
  font-size: var(--t-xl);
}

.setup__header p {
  max-width: 62ch;
  color: var(--muted);
  font-size: var(--t-sm);
}

.setup__state {
  min-height: 1.4em;
  color: var(--ok);
}

.setup__error {
  color: var(--rec);
}

.setup__pair {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 2rem clamp(1.5rem, 4vw, 3.5rem);
}

.group {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 0.75rem;
}

legend {
  padding: 0;
  margin-bottom: 0.75rem;
  font-size: var(--t-sm);
  font-weight: 600;
  color: var(--muted);
}

.choices {
  display: grid;
  gap: 0.15rem;
}

.makes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.make {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 0.7rem;
  padding: 0.9rem 1rem;
  border-radius: var(--r-panel);
  border: 1px solid var(--line);
  background: var(--surface-raised);
  cursor: pointer;
}

.make:has(input:checked) {
  border-color: var(--caption);
  box-shadow: 0 0 0 1px var(--caption);
}

.make:has(input:checked) .choice__label {
  color: var(--caption);
}

.make input {
  grid-row: span 2;
  margin-top: 0.3rem;
  accent-color: var(--caption);
}

.choice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 0.7rem;
  padding: 0.45rem 0.6rem;
  margin-inline: -0.6rem;
  border-radius: var(--r-control);
  cursor: pointer;
}

.choice:hover {
  background: var(--surface-raised);
}

.choice input {
  grid-row: span 2;
  margin-top: 0.3rem;
  accent-color: var(--caption);
}

.choice__label {
  font-weight: 600;
}

.choice__text {
  color: var(--muted);
  font-size: var(--t-sm);
}

.choice:has(input:checked) .choice__label {
  color: var(--caption);
}

.field {
  display: grid;
  gap: 0.4rem;
}

.field label {
  font-size: var(--t-sm);
  color: var(--muted);
}

.field input,
.field textarea {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border-radius: var(--r-control);
  border: 1px solid var(--line-strong);
  background: var(--surface-sunken);
  color: var(--text);
  font: inherit;
  font-family: var(--mono);
  font-size: var(--t-sm);
  resize: vertical;
}

.field input:focus-visible,
.field textarea:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.field__hint {
  color: var(--faint);
  font-size: var(--t-xs);
}

.note {
  display: grid;
  gap: 0.5rem;
  padding: 1rem 1.1rem;
  border-radius: var(--r-panel);
  border: 1px solid color-mix(in srgb, var(--warn) 45%, transparent);
  background: color-mix(in srgb, var(--warn) 8%, transparent);
  font-size: var(--t-sm);
  color: var(--muted);
}

.note__title {
  color: var(--text);
  font-weight: 650;
}

.note ol {
  margin: 0;
  padding-left: 1.2rem;
  display: grid;
  gap: 0.3rem;
}

.note code {
  font-family: var(--mono);
  font-size: 0.92em;
  color: var(--text);
}

@media (max-width: 900px) {
  .makes,
  .setup__pair {
    grid-template-columns: 1fr;
  }
}
</style>
