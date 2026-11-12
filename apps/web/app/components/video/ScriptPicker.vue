<script setup lang="ts">
import type { BeatRoleDto, ScriptDto, ScriptFormatDto, ScriptSetDto } from '#shared/types/api'

/**
 * The scripts Claude wrote for one video, each with what a viewer who knew nothing of the
 * product made of it. The user reads them, may change the words, and picks the one to make.
 */
const props = defineProps<{
  scripts: ScriptSetDto
  /** The choice is on its way, or the video is being made. */
  busy: boolean
  /** Claude Code is installed and signed in. */
  ready: boolean
  /** Why the last choice was refused. */
  error: string | null
  /** The label of the main button. */
  action: string
}>()

const emit = defineEmits<{
  choose: [index: number, texts: string[] | null]
  /** Write new scripts from scratch. */
  rewrite: []
}>()

const FORMATS: Record<ScriptFormatDto, string> = {
  'play-along': 'Jouez avec moi',
  'demo-first': 'Démo d’abord',
  'before-after': 'Avant / après',
  myth: 'Idée reçue',
  pov: 'POV',
  list: 'Liste',
  'problem-solution': 'Problème, solution',
  challenge: 'Défi',
}

const ROLES: Record<BeatRoleDto, string> = {
  hook: 'Accroche',
  context: 'Ce que c’est',
  tension: 'Enjeu',
  proof: 'Preuve',
  rehook: 'Relance',
  payoff: 'Réponse',
  cta: 'Action',
}

const VERDICTS = {
  pass: { tone: 'ok', label: 'Compris et regardé jusqu’au bout' },
  weak: { tone: 'idle', label: 'Compris tard, ou décroche en route' },
  fail: { tone: 'fail', label: 'Pas compris, ou zappé tout de suite' },
} as const

const initial = () => props.scripts.chosen?.index ?? props.scripts.recommended
const selected = ref(initial())
watch(
  () => props.scripts.writtenAt,
  () => {
    selected.value = initial()
    editing.value = false
  },
)

const script = computed<ScriptDto | undefined>(() => props.scripts.candidates[selected.value])

/** The words the user is typing, one per beat. */
const editing = ref(false)
const drafts = ref<string[]>([])
const startEditing = () => {
  drafts.value = script.value?.beats.map((beat) => beat.onScreen) ?? []
  editing.value = true
}
const select = (index: number) => {
  selected.value = index
  editing.value = false
}

const changed = computed(() => editing.value && drafts.value.some((text, index) => text.trim() !== script.value?.beats[index]?.onScreen))
const choose = () => emit('choose', selected.value, changed.value ? drafts.value.map((text) => text.trim()) : null)

/** `*emphasis*` markers, as alternating plain and highlighted pieces. */
const pieces = (text: string) => text.split('*').map((value, index) => ({ value, strong: index % 2 === 1 }))
const seconds = (value: number) => `${value.toFixed(1).replace('.', ',')} s`
</script>

<template>
  <section class="scripts" aria-label="Scripts proposés">
    <header class="scripts__intro">
      <h4>{{ scripts.candidates.length }} scripts écrits, testés à froid, réécrits.</h4>
      <p>
        Chacun a été montré à un spectateur qui ne connaissait pas le produit et ne voyait que l’écran. Il dit ce qu’il a
        compris, quand, et où il aurait zappé. Choisissez celui à réaliser ; vous pouvez en changer les mots.
      </p>
    </header>

    <div class="tabs" role="tablist" aria-label="Scripts">
      <button
        v-for="(candidate, index) in scripts.candidates"
        :key="index"
        type="button"
        role="tab"
        class="tab"
        :aria-selected="index === selected"
        @click="select(index)"
      >
        <span class="tab__title">
          {{ FORMATS[candidate.format] }}
          <span v-if="index === scripts.recommended" class="tab__badge">Recommandé</span>
          <span v-if="scripts.chosen?.index === index" class="tab__badge tab__badge--chosen">Réalisé</span>
        </span>
        <span class="tab__hook">
          <template v-for="(piece, at) in pieces(candidate.beats[0]?.onScreen ?? '')" :key="at">{{ piece.value }}</template>
        </span>
        <span v-if="candidate.verdict" class="tab__verdict" :data-verdict="candidate.verdict">{{ VERDICTS[candidate.verdict].label }}</span>
      </button>
    </div>

    <article v-if="script" class="script" role="tabpanel">
      <p class="script__angle">{{ script.angle }}</p>
      <p v-if="script.openLoop" class="script__loop"><span>Question ouverte</span>{{ script.openLoop }}</p>

      <!-- What a viewer who knew nothing made of it. -->
      <div v-if="script.test" class="test" :data-verdict="script.verdict">
        <div class="test__head">
          <UiStatus v-if="script.verdict" :tone="VERDICTS[script.verdict].tone" :label="VERDICTS[script.verdict].label" />
          <span v-if="script.edited" class="test__stale">Testé avant vos modifications</span>
        </div>
        <dl class="test__facts">
          <div>
            <dt>Ce qu’il a compris</dt>
            <dd>« {{ script.test.whatItIs }} »</dd>
          </div>
          <div v-if="script.test.whatFor">
            <dt>Ce qu’il en ferait</dt>
            <dd>« {{ script.test.whatFor }} »</dd>
          </div>
          <div>
            <dt>Compris</dt>
            <dd>{{ script.test.understoodAt === null ? 'Jamais' : `À ${seconds(script.test.understoodAt)}` }}</dd>
          </div>
          <div>
            <dt>Regardé</dt>
            <dd>
              {{ script.test.leftAt === null ? 'Jusqu’au bout' : `Zappe à ${seconds(script.test.leftAt)}` }}
              <span class="test__why">{{ script.test.why }}</span>
            </dd>
          </div>
          <div v-if="script.test.confusing.length > 0">
            <dt>Pas compris</dt>
            <dd>
              <ul class="test__confusing">
                <li v-for="(line, at) in script.test.confusing" :key="at">{{ line }}</li>
              </ul>
            </dd>
          </div>
        </dl>
        <ul class="scores" aria-label="Notes du spectateur sur 10">
          <li v-for="(value, key) in script.test.scores" :key="key">
            <span>{{ { hook: 'Accroche', clarity: 'Clarté', retention: 'Envie de voir la fin' }[key] }}</span>
            <span class="scores__bar"><span :style="{ width: `${value * 10}%` }" /></span>
            <span class="mono">{{ value }}</span>
          </li>
        </ul>
      </div>
      <p v-else class="test test--none">Aucun spectateur n’a pu regarder ce script.</p>

      <!-- The script itself, beat by beat. -->
      <ol class="beats" aria-label="Le script, temps par temps">
        <li v-for="(beat, index) in script.beats" :key="index" :data-role="beat.role">
          <span class="beats__time mono">{{ seconds(beat.start) }}</span>
          <span class="beats__role">{{ ROLES[beat.role] }}</span>
          <span class="beats__body">
            <textarea
              v-if="editing"
              v-model="drafts[index]"
              class="beats__input"
              rows="2"
              :aria-label="`Texte du temps ${index + 1}, ${ROLES[beat.role]}`"
            />
            <span v-else-if="beat.onScreen" class="beats__text">
              <template v-for="(piece, at) in pieces(beat.onScreen)" :key="at">
                <mark v-if="piece.strong">{{ piece.value }}</mark>
                <template v-else>{{ piece.value }}</template>
              </template>
            </span>
            <span v-else class="beats__text beats__text--none">Rien à lire</span>
            <span class="beats__visual">{{ beat.visual }}</span>
          </span>
        </li>
      </ol>
      <p v-if="editing" class="script__hint">Les *astérisques* marquent les mots mis en valeur. Un texte plus long reste plus longtemps à l’écran.</p>

      <p class="script__post"><span>À publier</span>{{ script.post.caption }} <em>{{ script.post.hashtags.join(' ') }}</em></p>

      <p v-if="error" class="script__error" role="alert">{{ error }}</p>

      <div class="script__actions">
        <UiButton :loading="busy" :disabled="!ready" @click="choose">{{ changed ? `${action}, avec mes mots` : action }}</UiButton>
        <UiButton v-if="!editing" variant="secondary" @click="startEditing">Modifier le texte</UiButton>
        <UiButton v-else variant="secondary" @click="editing = false">Annuler les modifications</UiButton>
        <UiButton variant="ghost" :disabled="!ready || busy" @click="emit('rewrite')">Réécrire les scripts</UiButton>
      </div>
      <p class="script__duration">{{ seconds(script.seconds) }} au total</p>
    </article>
  </section>
</template>

<style scoped>
.scripts {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.scripts__intro {
  display: grid;
  gap: 0.3rem;
}

.scripts__intro h4 {
  font-size: var(--t-md);
}

.scripts__intro p {
  max-width: 64ch;
  color: var(--muted);
  font-size: var(--t-sm);
}

/* ── Tabs ── */

.tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: 0.5rem;
}

.tab {
  display: grid;
  align-content: start;
  gap: 0.35rem;
  padding: 0.75rem 0.9rem;
  border-radius: var(--r-control);
  border: 1px solid var(--line);
  background: var(--surface-sunken);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.tab:hover {
  border-color: var(--line-strong);
}

.tab[aria-selected='true'] {
  border-color: var(--hue);
  background: color-mix(in srgb, var(--hue) 9%, var(--surface-sunken));
}

.tab:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.tab__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--t-sm);
  font-weight: 650;
}

.tab__badge {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--playhead-soft);
  color: var(--caption);
  font-size: 0.72rem;
  font-weight: 600;
}

.tab__badge--chosen {
  background: var(--ok-soft);
  color: var(--ok);
}

.tab__hook {
  font-family: var(--display);
  font-weight: 650;
  line-height: 1.25;
}

.tab__verdict {
  font-size: var(--t-xs);
  color: var(--muted);
}

.tab__verdict[data-verdict='pass'] {
  color: var(--ok);
}

.tab__verdict[data-verdict='fail'] {
  color: var(--rec);
}

/* ── The script ── */

.script {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.script__angle {
  max-width: 64ch;
  font-size: var(--t-sm);
  color: var(--muted);
}

.script__loop,
.script__post {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.7rem;
  font-size: var(--t-sm);
}

.script__loop span,
.script__post span {
  color: var(--faint);
}

.script__post em {
  color: var(--muted);
  font-style: normal;
}

.test {
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem 1.1rem;
  border-radius: var(--r-panel);
  border: 1px solid var(--line);
  background: var(--surface-sunken);
}

.test[data-verdict='fail'] {
  border-color: color-mix(in srgb, var(--rec) 40%, transparent);
}

.test--none {
  color: var(--muted);
  font-size: var(--t-sm);
}

.test__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.test__stale {
  font-size: var(--t-xs);
  color: var(--warn);
}

.test__facts {
  margin: 0;
  display: grid;
  gap: 0.35rem;
  font-size: var(--t-sm);
}

.test__facts div {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr);
  gap: 0.8rem;
}

.test__facts dt {
  color: var(--faint);
}

.test__facts dd {
  margin: 0;
}

.test__confusing {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.2rem;
}

.test__why {
  display: block;
  color: var(--muted);
}

.scores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.3rem;
  font-size: var(--t-xs);
}

.scores li {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr) 1.5rem;
  align-items: center;
  gap: 0.8rem;
  color: var(--muted);
}

.scores__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--line-strong);
  overflow: hidden;
}

.scores__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--hue);
}

.scores .mono {
  text-align: right;
  color: var(--text);
}

/* ── Beats ── */

.beats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  border-top: 1px solid var(--line);
}

.beats li {
  display: grid;
  grid-template-columns: 3.4rem 6.5rem minmax(0, 1fr);
  gap: 0.8rem;
  align-items: baseline;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--t-sm);
}

.beats__time,
.beats__role {
  color: var(--faint);
  font-size: var(--t-xs);
}

.beats [data-role='context'] .beats__role,
.beats li[data-role='context'] .beats__role {
  color: var(--hue);
  font-weight: 600;
}

.beats__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.beats__text {
  font-weight: 550;
}

.beats__text mark {
  background: none;
  color: var(--hue);
  font-weight: 700;
}

.beats__text--none {
  color: var(--faint);
  font-weight: 400;
  font-style: italic;
}

.beats__visual {
  color: var(--muted);
  font-size: var(--t-xs);
}

.beats__input {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--line-strong);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  resize: vertical;
}

.beats__input:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.script__hint,
.script__duration {
  color: var(--faint);
  font-size: var(--t-xs);
}

.script__error {
  padding: 0.7rem 0.9rem;
  border-radius: var(--r-control);
  background: var(--rec-soft);
  font-size: var(--t-sm);
}

.script__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 560px) {
  .beats li {
    grid-template-columns: 3rem minmax(0, 1fr);
  }

  .beats__role {
    grid-column: 2;
  }

  .beats__body {
    grid-column: 1 / -1;
  }

  .test__facts div,
  .scores li {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.1rem;
  }

  .scores li {
    grid-template-columns: 7rem minmax(0, 1fr) 1.5rem;
  }
}
</style>
