<script setup lang="ts">
import type { PersonaDto, PersonaStyleDto, ProductBriefDto, ScriptSetDto, VideoDto, VideoSetupDto, VideoStyleDto } from '#shared/types/api'

/** One persona's video, whatever its state: to generate, scripts to choose from, in production, ready to post, or failed. */
const props = defineProps<{
  persona: PersonaDto
  brief: ProductBriefDto
  hue: string
  /** Null until a video was asked for this persona. */
  video: VideoDto | null
  /** The request to generate it is on its way. */
  requesting: boolean
  /** Claude Code is installed and signed in. */
  ready: boolean
  /** The style this persona's next video will be made in. */
  entry: PersonaStyleDto
  /** What all the project's videos share. */
  setup: VideoSetupDto
  /** The scripts written for this video, once there are some. */
  scripts: ScriptSetDto | null
  /** A script was just picked and is on its way. */
  choosing: boolean
  /** Why the last pick was refused. */
  chooseError: string | null
}>()

defineEmits<{
  generate: []
  /** The user picked a script, with their own words if they changed them. */
  pick: [index: number, texts: string[] | null]
  /** The user changed this persona's style, went back to Claude's proposal, or wants it for everyone. */
  choose: [style: VideoStyleDto]
  reset: []
  everyone: []
}>()

const mockup = computed(() => reelFromPersona(props.brief, props.persona, props.hue))
const pending = computed(() => props.video?.status === 'queued' || props.video?.status === 'running')
const percent = computed(() =>
  props.video?.status === 'running' && props.video.step === 'render' ? Math.round((props.video.progress ?? 0) * 100) : null,
)

/** What this video was made with, and whether the project's choices have changed since. */
const chips = computed(() => (props.video && props.video.status !== 'failed' ? directionChips(props.video.direction) : []))
const outdated = computed(() => props.video?.status === 'succeeded' && !madeWith(props.video.direction, props.entry.style, props.setup))

const STEP_LABELS = {
  scout: 'Choix des pages',
  capture: "Capture de l'application",
  script: 'Écriture des scripts',
  storyboard: 'Écriture du storyboard',
  direct: 'Réalisation par Claude',
  render: 'Rendu en cours',
}

/**
 * The steps this video goes through, in order. First the scripts (filming the application
 * before, when the video shows it), then, once one is picked, the video itself.
 */
const steps = computed(() => {
  const video = props.video
  if (!video || (video.status !== 'queued' && video.status !== 'running')) return []
  const { mode } = video.direction.demo
  const all = props.scripts?.chosen
    ? [
        video.direction.production === 'directed'
          ? { key: 'direct', label: 'Claude réalise la vidéo sur ce script : concept, animation, corrections' }
          : { key: 'storyboard', label: 'Claude place le script dans les plans' },
        { key: 'render', label: 'Rendu de la vidéo' },
      ]
    : [
        ...(mode === 'auto' ? [{ key: 'scout', label: 'Claude choisit les pages à montrer' }] : []),
        ...(mode !== 'none' ? [{ key: 'capture', label: "Capture de l'application" }] : []),
        { key: 'script', label: 'Claude écrit 3 scripts, les fait tester à froid, puis les réécrit' },
        { key: 'choose', label: 'Vous choisissez le script' },
      ]
  const current = video.status === 'running' ? all.findIndex((step) => step.key === video.step) : -1
  return all.map((step, index) => ({ ...step, state: index < current ? 'done' : index === current ? 'active' : 'todo' }))
})

const status = computed<{ tone: StatusTone; label: string }>(() => {
  const video = props.video
  if (!video) return { tone: 'idle', label: 'À générer' }
  switch (video.status) {
    case 'queued':
      return { tone: 'rec', label: "En file d'attente" }
    case 'running':
      return { tone: 'rec', label: STEP_LABELS[video.step] }
    case 'scripted':
      return { tone: 'idle', label: 'Script à choisir' }
    case 'succeeded':
      return { tone: 'ok', label: `Prête, ${Math.round(video.seconds)} secondes` }
    case 'failed':
      return { tone: 'fail', label: 'Échec' }
  }
})

/** The storyboard's `*emphasis*` markers, as alternating plain and highlighted pieces. */
const pieces = (text: string) => text.split('*').map((value, index) => ({ value, strong: index % 2 === 1 }))

const outline = computed(() => (props.video?.status === 'succeeded' ? props.video.outline : null))
const shots = computed(() => (outline.value?.shots ?? []).map((shot) => ({ label: shot.label, seconds: shot.seconds, texts: shot.texts.map(pieces) })))

const post = computed(() => outline.value?.post ?? null)

/** What Claude is doing right now, when it is writing the scripts or directing. */
const activity = computed(() =>
  props.video?.status === 'running' && (props.video.step === 'direct' || props.video.step === 'script') ? props.video.activity : null,
)
const directed = computed(() => props.setup.production === 'directed')
/** What making the video from a script means, the way this project makes them. */
const makeLabel = computed(() => ((props.video?.status === 'scripted' ? props.video.direction : props.setup).production === 'directed' ? 'Réaliser avec ce script' : 'Assembler avec ce script'))

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
const copyPost = async () => {
  if (!post.value) return
  await navigator.clipboard.writeText(`${post.value.caption}\n\n${post.value.hashtags.join(' ')}`)
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2_000)
}
onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <article class="video" :style="{ '--hue': hue }" :aria-label="`Vidéo pour ${persona.name}`">
    <div class="video__screen">
      <!-- The real video. -->
      <MotionPhoneFrame v-if="video?.status === 'succeeded'" :brand="brief.brand.colors.primary" width="100%" glow>
        <video :key="video.url" :src="video.url" class="video__player" controls loop playsinline preload="metadata" />
      </MotionPhoneFrame>

      <!-- Being produced. -->
      <MotionPhoneFrame v-else-if="pending" :brand="hue" width="100%" scanning>
        <div class="making" aria-hidden="true">
          <template v-if="percent !== null">
            <span class="making__percent">{{ percent }}<small>%</small></span>
            <span class="making__bar"><span :style="{ width: `${percent}%` }" /></span>
          </template>
          <template v-else>
            <span class="making__line" style="width: 78%" />
            <span class="making__line" style="width: 92%" />
            <span class="making__line" style="width: 55%" />
          </template>
        </div>
      </MotionPhoneFrame>

      <!-- Not made yet: a mock-up of its structure, clearly not the video. -->
      <div v-else class="video__draft">
        <MotionReelPlayer :reel="mockup" mode="poster" width="100%" :glow="false" />
        <span class="video__draft-label">Maquette</span>
      </div>
    </div>

    <div class="video__body">
      <header class="video__header">
        <div>
          <h3 class="video__name"><span class="video__dot" aria-hidden="true" />{{ persona.name }}</h3>
          <p class="video__role">{{ persona.role }}</p>
        </div>
        <UiStatus :tone="status.tone" :label="status.label" />
      </header>

      <ul v-if="chips.length > 0" class="video__chips" aria-label="Réglages de cette vidéo">
        <li v-for="chip in chips" :key="chip">{{ chip }}</li>
      </ul>

      <!-- To generate. -->
      <template v-if="!video">
        <blockquote class="video__hook">{{ persona.hook }}</blockquote>
        <VideoStylePicker :entry="entry" :has-track="Boolean(setup.track)" @choose="$emit('choose', $event)" @reset="$emit('reset')" @everyone="$emit('everyone')" />
        <p class="video__note">
          Claude écrit d'abord trois scripts dans des formats différents, les fait regarder par des spectateurs qui ne
          connaissent pas {{ brief.productName }}, puis les réécrit là où ils ont décroché : quelques minutes. Vous
          choisissez ensuite le script.
          <template v-if="directed">Claude réalise alors la vidéo sur mesure, dans ce style : comptez 10 à 30 minutes.</template>
          <template v-else>La vidéo est alors assemblée dans ce style, aux couleurs du produit : environ une minute.</template>
        </p>
        <div class="video__actions">
          <UiButton :loading="requesting" :disabled="!ready" @click="$emit('generate')">Générer la vidéo</UiButton>
        </div>
      </template>

      <!-- In production. -->
      <template v-else-if="video.status === 'queued' || video.status === 'running'">
        <ol class="steps" aria-live="polite">
          <li v-for="step in steps" :key="step.key" :data-state="step.state">
            <span class="steps__mark" aria-hidden="true" />
            {{ step.label }}
            <span v-if="step.key === 'render' && percent !== null" class="mono">{{ percent }} %</span>
          </li>
        </ol>
        <p v-if="activity" class="video__activity" aria-live="polite">{{ activity }}</p>
        <p class="video__note">
          <MotionTimecode :since="video.status === 'running' ? video.startedAt : video.requestedAt" />
          <span>Vous pouvez changer de page : la production continue tant que repo-motion reste ouvert.</span>
        </p>
      </template>

      <!-- The scripts are written: the user picks one. -->
      <template v-else-if="video.status === 'scripted' && scripts">
        <VideoScriptPicker
          :scripts="scripts"
          :busy="choosing"
          :ready="ready"
          :error="chooseError"
          :action="makeLabel"
          @choose="(index, texts) => $emit('pick', index, texts)"
          @rewrite="$emit('generate')"
        />
      </template>

      <!-- Failed: once the scripts exist, the user may try again with one of them. -->
      <template v-else-if="video.status === 'failed'">
        <p class="video__failure" role="alert">{{ video.reason }}</p>
        <VideoScriptPicker
          v-if="scripts"
          :scripts="scripts"
          :busy="choosing"
          :ready="ready"
          :error="chooseError"
          action="Réessayer avec ce script"
          @choose="(index, texts) => $emit('pick', index, texts)"
          @rewrite="$emit('generate')"
        />
        <template v-else>
          <VideoStylePicker :entry="entry" :has-track="Boolean(setup.track)" @choose="$emit('choose', $event)" @reset="$emit('reset')" @everyone="$emit('everyone')" />
          <div class="video__actions">
            <UiButton :loading="requesting" :disabled="!ready" @click="$emit('generate')">Réessayer</UiButton>
          </div>
        </template>
      </template>

      <!-- Ready to post. -->
      <template v-else-if="video.status === 'succeeded'">
        <p v-if="outline?.concept" class="video__concept">{{ outline.concept }}</p>
        <ol class="shots" aria-label="Plans de la vidéo">
          <li v-for="(shot, index) in shots" :key="index">
            <span class="shots__label">{{ shot.label }}</span>
            <span class="shots__text">
              <span v-for="(text, line) in shot.texts" :key="line">
                <template v-for="(piece, at) in text" :key="at">
                  <mark v-if="piece.strong">{{ piece.value }}</mark>
                  <template v-else>{{ piece.value }}</template>
                </template>
              </span>
            </span>
            <span class="shots__seconds mono">{{ shot.seconds.toFixed(1) }} s</span>
          </li>
        </ol>

        <section v-if="post" class="post" aria-label="Texte de la publication">
          <h4>À publier avec la vidéo</h4>
          <p class="post__caption">{{ post.caption }}</p>
          <p class="post__tags">{{ post.hashtags.join(' ') }}</p>
        </section>

        <!-- Another of the scripts, without writing them again. -->
        <details v-if="scripts" class="next-style">
          <summary>
            Faire une version avec un autre script
            <span>{{ scripts.candidates.length }} scripts écrits</span>
          </summary>
          <VideoScriptPicker
            :scripts="scripts"
            :busy="choosing"
            :ready="ready"
            :error="chooseError"
            action="Refaire avec ce script"
            @choose="(index, texts) => $emit('pick', index, texts)"
            @rewrite="$emit('generate')"
          />
        </details>

        <!-- The style of the next version: folded away, since the video is what matters now. -->
        <details class="next-style" :open="outdated">
          <summary>
            Style de la prochaine version
            <span>{{ styleSummary(entry.style) }}</span>
          </summary>
          <VideoStylePicker :entry="entry" :has-track="Boolean(setup.track)" @choose="$emit('choose', $event)" @reset="$emit('reset')" @everyone="$emit('everyone')" />
        </details>

        <div class="video__actions">
          <UiButton :href="`${video.url}&download`">Télécharger le MP4</UiButton>
          <UiButton variant="secondary" @click="copyPost">{{ copied ? 'Texte copié' : 'Copier le texte' }}</UiButton>
          <UiButton variant="ghost" :loading="requesting" :disabled="!ready" @click="$emit('generate')">
            {{ outdated ? 'Réécrire dans ce style' : 'Réécrire les scripts' }}
          </UiButton>
        </div>
      </template>
    </div>
  </article>
</template>

<style scoped>
.video {
  display: grid;
  grid-template-columns: minmax(0, 250px) minmax(0, 1fr);
  gap: clamp(1.25rem, 4vw, 3rem);
  align-items: start;
  padding: clamp(1.25rem, 3vw, 2.25rem);
  border-radius: var(--r-tile);
  border: 1px solid var(--line);
  background:
    radial-gradient(50% 80% at 0% 0%, color-mix(in srgb, var(--hue) 13%, transparent), transparent 70%),
    var(--surface);
}

.video__screen {
  position: relative;
}

.video__player {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
}

.video__draft {
  position: relative;
  opacity: 0.55;
  filter: saturate(0.6);
}

.video__draft-label {
  position: absolute;
  top: 0.9rem;
  left: 50%;
  translate: -50% 0;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.7);
  font-size: var(--t-xs);
  color: var(--text);
}

/* ── In production: what the phone shows ── */

.making {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 5cqi;
  padding: 10cqi;
  background: var(--surface-sunken);
}

.making__percent {
  font-family: var(--display);
  font-weight: 800;
  font-size: 30cqi;
  line-height: 1;
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
}

.making__percent small {
  font-size: 0.4em;
  color: var(--muted);
}

.making__bar {
  width: 100%;
  height: 2.4cqi;
  border-radius: 999px;
  background: var(--line-strong);
  overflow: hidden;
}

.making__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--rec);
  transition: width 600ms ease-out;
}

.making__line {
  height: 7cqi;
  border-radius: 2cqi;
  background: rgb(255 255 255 / 0.14);
  animation: breathe 1.6s ease-in-out infinite;
}

.making__line:nth-child(2) {
  animation-delay: 200ms;
}

.making__line:nth-child(3) {
  animation-delay: 400ms;
  background: var(--hue);
}

@keyframes breathe {
  50% {
    opacity: 0.4;
  }
}

/* ── Body ── */

.video__body {
  display: grid;
  gap: 1.25rem;
  min-width: 0;
}

.video__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: start;
  gap: 0.75rem;
}

.video__name {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: var(--t-xl);
}

.video__dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--hue);
}

.video__role {
  color: var(--muted);
  font-size: var(--t-sm);
}

.video__chips {
  list-style: none;
  margin: -0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: var(--t-xs);
  color: var(--muted);
}

.video__chips li {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
}

.video__hook {
  margin: 0;
  padding-left: 1rem;
  border-left: 3px solid var(--hue);
  font-family: var(--display);
  font-weight: 700;
  font-size: var(--t-lg);
  line-height: 1.25;
  max-width: 34ch;
}

.video__note {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 1rem;
  max-width: 60ch;
  color: var(--muted);
  font-size: var(--t-sm);
}

.video__activity {
  padding: 0.55rem 0.9rem;
  border-radius: var(--r-control);
  border-left: 3px solid var(--rec);
  background: var(--surface-sunken);
  font-size: var(--t-sm);
}

.video__concept {
  max-width: 62ch;
  font-family: var(--display);
  font-weight: 650;
  font-size: var(--t-lg);
  line-height: 1.3;
}

.video__failure {
  max-width: 60ch;
  padding: 0.8rem 1rem;
  border-radius: var(--r-control);
  background: var(--rec-soft);
  color: var(--text);
  font-size: var(--t-sm);
  white-space: pre-line;
}

.video__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

/* ── Steps ── */

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}

.steps li {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  color: var(--faint);
}

.steps__mark {
  width: 0.7rem;
  height: 0.7rem;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid currentColor;
}

.steps [data-state='active'] {
  color: var(--text);
}

.steps [data-state='active'] .steps__mark {
  border-color: var(--rec);
  background: var(--rec);
  animation: breathe 1.2s ease-in-out infinite;
}

.steps [data-state='done'] {
  color: var(--muted);
}

.steps [data-state='done'] .steps__mark {
  border-color: var(--ok);
  background: var(--ok);
}

/* ── Storyboard ── */

.shots {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  border-top: 1px solid var(--line);
}

.shots li {
  display: grid;
  grid-template-columns: 8.5rem minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: baseline;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--t-sm);
}

.shots__label {
  color: var(--faint);
}

.shots__text {
  display: grid;
  gap: 0.1rem;
}

.shots__text mark {
  background: none;
  color: var(--hue);
  font-weight: 650;
}

.shots__seconds {
  color: var(--faint);
  font-size: var(--t-xs);
}

/* ── Style of the next version ── */

.next-style {
  padding: 0.85rem 1.1rem;
  border-radius: var(--r-panel);
  border: 1px solid var(--line);
}

.next-style summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.8rem;
  font-size: var(--t-sm);
  font-weight: 600;
  cursor: pointer;
}

.next-style summary span {
  color: var(--muted);
  font-weight: 400;
}

.next-style[open] summary {
  margin-bottom: 0.9rem;
}

/* ── Post ── */

.post {
  display: grid;
  gap: 0.35rem;
  padding: 1rem 1.1rem;
  border-radius: var(--r-panel);
  background: var(--surface-sunken);
  border: 1px solid var(--line);
}

.post h4 {
  font-family: var(--font);
  font-size: var(--t-xs);
  font-weight: 600;
  color: var(--faint);
}

.post__caption {
  max-width: 62ch;
}

.post__tags {
  color: var(--muted);
  font-size: var(--t-sm);
}

@media (max-width: 720px) {
  .video {
    grid-template-columns: 1fr;
  }

  .video__screen {
    width: min(100%, 230px);
    justify-self: center;
  }

  .shots li {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .shots__label {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .making__line,
  .steps__mark {
    animation: none !important;
  }
}
</style>
