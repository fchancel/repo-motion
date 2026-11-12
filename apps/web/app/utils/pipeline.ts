import type { ProjectDto } from '#shared/types/api'
import type { StatusTone } from './status'

/** A project moves through three stages, like clips on a timeline. */
export type StageKey = 'brief' | 'personas' | 'videos'

export type StageState = 'todo' | 'running' | 'done' | 'failed' | 'locked'

export interface Stage {
  key: StageKey
  label: string
  detail: string
  state: StageState
  path: string
}

const STATE_TONE: Record<StageState, StatusTone> = {
  todo: 'idle',
  running: 'rec',
  done: 'ok',
  failed: 'fail',
  locked: 'locked',
}

export const stageTone = (state: StageState): StatusTone => STATE_TONE[state]

/** Both the analysis and the personas go through the same statuses. */
const stateOf = (status: ProjectDto['analysis']['status']): StageState => {
  switch (status) {
    case 'not_started':
      return 'todo'
    case 'queued':
    case 'running':
      return 'running'
    case 'succeeded':
      return 'done'
    case 'failed':
      return 'failed'
  }
}

export const projectStages = (project: ProjectDto): Stage[] => {
  const base = `/projects/${project.id}`
  const brief = stateOf(project.analysis.status)
  const personas: StageState = brief === 'done' ? stateOf(project.personas.status) : 'locked'
  const made = videoCounts(project)
  const videos: StageState =
    personas !== 'done'
      ? 'locked'
      : made.pending > 0
        ? 'running'
        : made.toChoose > 0
          ? 'todo'
          : made.ready > 0
            ? 'done'
            : made.failed > 0
              ? 'failed'
              : 'todo'

  const personaCount = project.personas.status === 'succeeded' ? project.personas.personas.length : 0
  const briefDetail = { todo: 'À lancer', running: 'Claude lit le code', done: 'Prêt', failed: 'À relancer', locked: '' }
  const personasDetail = {
    todo: 'À écrire',
    running: 'Claude les imagine',
    done: `${personaCount} personas`,
    failed: 'À relancer',
    locked: 'Après le brief',
  }
  const videosDetail = {
    todo: made.toChoose > 0 ? (made.toChoose > 1 ? `${made.toChoose} scripts à choisir` : 'Un script à choisir') : 'À générer',
    running: made.pending > 1 ? `${made.pending} en production` : 'En production',
    done: made.ready > 1 ? `${made.ready} prêtes` : '1 prête',
    failed: 'À relancer',
    locked: 'Après les personas',
  }

  return [
    { key: 'brief', label: 'Brief produit', detail: briefDetail[brief], state: brief, path: base },
    { key: 'personas', label: 'Personas', detail: personasDetail[personas], state: personas, path: `${base}/personas` },
    {
      key: 'videos',
      label: 'Vidéos',
      detail: videosDetail[videos],
      state: videos,
      path: `${base}/videos`,
    },
  ]
}

/** One-line summary of where a project stands, for lists. */
export const projectHeadline = (project: ProjectDto): { tone: StatusTone; label: string } => {
  switch (project.analysis.status) {
    case 'not_started':
      return { tone: 'idle', label: 'À analyser' }
    case 'queued':
      return { tone: 'rec', label: "En file d'attente" }
    case 'running':
      return { tone: 'rec', label: 'Analyse en cours' }
    case 'failed':
      return { tone: 'fail', label: 'Analyse échouée' }
    case 'succeeded':
      break
  }

  const made = videoCounts(project)
  if (made.pending > 0) return { tone: 'rec', label: made.pending > 1 ? `${made.pending} vidéos en production` : 'Vidéo en production' }
  if (made.toChoose > 0) return { tone: 'idle', label: made.toChoose > 1 ? `${made.toChoose} scripts à choisir` : 'Un script à choisir' }
  if (made.ready > 0) return { tone: 'ok', label: made.ready > 1 ? `${made.ready} vidéos prêtes` : '1 vidéo prête' }

  switch (project.personas.status) {
    case 'queued':
    case 'running':
      return { tone: 'rec', label: 'Personas en cours' }
    case 'succeeded':
      return { tone: 'ok', label: `${project.personas.personas.length} personas prêts` }
    case 'failed':
      return { tone: 'fail', label: 'Personas échoués' }
    case 'not_started':
      return { tone: 'ok', label: 'Brief prêt' }
  }
}

/** True while background work is pending on the project: pages poll while it is. */
export const projectIsBusy = (project: ProjectDto): boolean =>
  [project.analysis.status, project.personas.status, ...project.videos.map(({ video }) => video.status)].some(
    (status) => status === 'queued' || status === 'running',
  )

/** How many videos are being produced, are ready, or failed. */
export const videoCounts = (project: ProjectDto) => {
  const count = (...statuses: string[]) => project.videos.filter(({ video }) => statuses.includes(video.status)).length
  return { pending: count('queued', 'running'), toChoose: count('scripted'), ready: count('succeeded'), failed: count('failed') }
}

export const projectBrandColor = (project: ProjectDto): string | null =>
  project.analysis.status === 'succeeded' ? project.analysis.brief.brand.colors.primary : null
