import type { Brand } from '../../shared/brand'
import type { Failure } from '../../shared/errors'
import { err, okVoid, type Result } from '../../shared/result'
import type { ProductBrief } from '../analysis/product-brief'
import type { Persona, Personas } from '../persona/persona'
import { DEFAULT_STYLE, VideoDirection, VideoSetup, type PersonaStyle, type StyleSuggestion, type VideoStyle } from '../video/direction'
import type { DirectedPiece } from '../video/piece'
import type { InvalidScript, ScriptSet } from '../video/script'
import type { Storyboard } from '../video/storyboard'
import type { ProjectFolder } from './project-folder'

export type ProjectId = Brand<string, 'ProjectId'>
export const ProjectId = (value: string) => value as ProjectId

/** Lifecycle of the codebase analysis. Each state only carries the data that makes sense in it. */
export type AnalysisState =
  | { readonly status: 'not_started' }
  | { readonly status: 'queued'; readonly requestedAt: Date }
  | {
      readonly status: 'running'
      readonly requestedAt: Date
      readonly startedAt: Date
      /** What Claude is doing right now, e.g. "Lecture de app/pages/index.vue". */
      readonly activity: string | null
    }
  | { readonly status: 'succeeded'; readonly brief: ProductBrief; readonly completedAt: Date }
  | { readonly status: 'failed'; readonly reason: string; readonly failedAt: Date }

export type AnalysisStatus = AnalysisState['status']

/** Lifecycle of the personas, which are written from the brief. */
export type PersonasState =
  | { readonly status: 'not_started' }
  | { readonly status: 'queued'; readonly requestedAt: Date }
  | { readonly status: 'running'; readonly requestedAt: Date; readonly startedAt: Date }
  | { readonly status: 'succeeded'; readonly personas: Personas; readonly completedAt: Date }
  | { readonly status: 'failed'; readonly reason: string; readonly failedAt: Date }

/** What a video is going through right now. */
export type VideoStep = 'scout' | 'capture' | 'script' | 'storyboard' | 'direct' | 'render'

/** What a finished video was made from: a storyboard filled into ready-made shots, or a piece Claude directed. */
export type VideoWork =
  | { readonly kind: 'storyboard'; readonly storyboard: Storyboard }
  | { readonly kind: 'piece'; readonly piece: DirectedPiece }

/** Lifecycle of one persona's video. A persona with no video yet simply has no entry. */
export type VideoState =
  /** `direction`: the choices in force when the video was asked for. It is made with those. */
  | { readonly status: 'queued'; readonly requestedAt: Date; readonly direction: VideoDirection }
  | {
      readonly status: 'running'
      readonly direction: VideoDirection
      readonly requestedAt: Date
      readonly startedAt: Date
      readonly step: VideoStep
      /** From 0 to 1 while rendering, when the renderer reports it. */
      readonly progress: number | null
      /** What Claude is doing right now, while it directs. */
      readonly activity: string | null
    }
  | {
      readonly status: 'succeeded'
      readonly direction: VideoDirection
      readonly work: VideoWork
      /** Where the MP4 is on this machine. */
      readonly file: string
      readonly seconds: number
      readonly completedAt: Date
    }
  /** The scripts are written and tested: the user picks the one to make. */
  | { readonly status: 'scripted'; readonly direction: VideoDirection; readonly requestedAt: Date; readonly scriptedAt: Date }
  | { readonly status: 'failed'; readonly reason: string; readonly failedAt: Date }

export interface ProjectVideo {
  /** Name of the persona this video is written for. */
  readonly persona: string
  readonly state: VideoState
  /**
   * The scripts written for it, and the one the user chose. Kept once the video is made or
   * has failed, so that another script can be made without writing them all again.
   */
  readonly scripts: ScriptSet | null
}

export interface ProjectSnapshot {
  readonly id: ProjectId
  readonly folder: ProjectFolder
  readonly analysis: AnalysisState
  readonly personas: PersonasState
  readonly videos: readonly ProjectVideo[]
  /** What all the videos share: where the application runs, the user's own music. */
  readonly videoSetup: VideoSetup
  /** What Claude proposed and what the user chose, for the personas that have either. */
  readonly styles: readonly PersonaStyle[]
  readonly createdAt: Date
}

export interface InvalidAnalysisTransition extends Failure<'InvalidAnalysisTransition'> {
  readonly from: AnalysisStatus
}

export interface InvalidPersonasTransition extends Failure<'InvalidPersonasTransition'> {
  readonly from: PersonasState['status']
}

export type BriefRequired = Failure<'BriefRequired'>
export type PersonaNotFound = Failure<'PersonaNotFound'>

export interface InvalidVideoTransition extends Failure<'InvalidVideoTransition'> {
  readonly from: VideoState['status'] | 'not_started'
}

const isPending = (state: { readonly status: string }) => state.status === 'queued' || state.status === 'running'

/** A folder the user added, and everything the application learnt from it. */
export class Project {
  private constructor(private state: ProjectSnapshot) {}

  static add(props: { id: ProjectId; folder: ProjectFolder; now: Date }): Project {
    return new Project({
      id: props.id,
      folder: props.folder,
      analysis: { status: 'not_started' },
      personas: { status: 'not_started' },
      videos: [],
      videoSetup: VideoSetup.default(),
      styles: [],
      createdAt: props.now,
    })
  }

  static restore(snapshot: ProjectSnapshot): Project {
    return new Project(snapshot)
  }

  get id(): ProjectId {
    return this.state.id
  }

  get folder(): ProjectFolder {
    return this.state.folder
  }

  get analysis(): AnalysisState {
    return this.state.analysis
  }

  get personas(): PersonasState {
    return this.state.personas
  }

  /** The brief, once the analysis has produced one. */
  get brief(): ProductBrief | null {
    return this.state.analysis.status === 'succeeded' ? this.state.analysis.brief : null
  }

  get isBeingAnalysed(): boolean {
    return isPending(this.state.analysis)
  }

  get videos(): readonly ProjectVideo[] {
    return this.state.videos
  }

  get videoSetup(): VideoSetup {
    return this.state.videoSetup
  }

  /** Applies to the videos asked for from now on: those made or in production keep theirs. */
  setUpVideos(setup: VideoSetup): void {
    this.state = { ...this.state, videoSetup: setup }
  }

  /** Every persona with the style of their videos, in the order of the personas. */
  get personaStyles(): readonly PersonaStyle[] {
    const personas = this.state.personas.status === 'succeeded' ? this.state.personas.personas.all : []
    return personas.map(({ name }) => this.state.styles.find((style) => style.persona === name) ?? { persona: name, suggestion: null, choice: null })
  }

  /** What the next video of that persona will look, speak and sound like: the user's choice, else Claude's proposal. */
  styleOf(persona: string): VideoStyle {
    const style = this.state.styles.find((candidate) => candidate.persona === persona)
    const { look, tone, sound } = style?.choice ?? style?.suggestion ?? DEFAULT_STYLE
    return { look, tone, sound }
  }

  /** Records what Claude proposes. Proposals for personas the project does not have are ignored; choices are kept. */
  suggestStyles(suggestions: readonly (StyleSuggestion & { readonly persona: string })[]): void {
    for (const { persona, ...suggestion } of suggestions) {
      if (this.persona(persona)) this.setStyle(persona, { suggestion })
    }
  }

  /**
   * Records the user's own choice for one persona, or for all of them when `persona` is null.
   * `style` null goes back to what Claude proposed.
   */
  chooseStyle(persona: string | null, style: VideoStyle | null): Result<void, PersonaNotFound> {
    if (persona !== null && !this.persona(persona)) {
      return err({ type: 'PersonaNotFound', message: `Le persona « ${persona} » n'existe pas dans ce projet.` })
    }
    for (const { persona: name } of this.personaStyles) {
      if (persona === null || persona === name) this.setStyle(name, { choice: style })
    }
    return okVoid
  }

  private setStyle(persona: string, change: Partial<Omit<PersonaStyle, 'persona'>>): void {
    const known = this.state.styles.some((style) => style.persona === persona)
    const styles = known
      ? this.state.styles.map((style) => (style.persona === persona ? { ...style, ...change } : style))
      : [...this.state.styles, { persona, suggestion: null, choice: null, ...change }]
    this.state = { ...this.state, styles }
  }

  private get hasPendingVideo(): boolean {
    return this.state.videos.some((video) => isPending(video.state))
  }

  /** True while any background work is pending for this project. */
  get isBusy(): boolean {
    return isPending(this.state.analysis) || isPending(this.state.personas) || this.hasPendingVideo
  }

  /** The persona of that name, once the personas have been written. */
  persona(name: string): Persona | null {
    const personas = this.state.personas
    return personas.status === 'succeeded' ? (personas.personas.all.find((persona) => persona.name === name) ?? null) : null
  }

  // ── Analysis ──────────────────────────────────────────────────────────────

  /** A new analysis can be requested unless work is already pending on the project. */
  requestAnalysis(now: Date): Result<void, InvalidAnalysisTransition> {
    if (this.isBeingAnalysed) return this.invalidAnalysis('Une analyse est déjà en cours pour ce projet.')
    if (isPending(this.state.personas)) return this.invalidAnalysis('Attendez la fin de la rédaction des personas.')
    if (this.hasPendingVideo) return this.invalidAnalysis('Attendez la fin des vidéos en cours.')
    return this.setAnalysis({ status: 'queued', requestedAt: now })
  }

  startAnalysis(now: Date): Result<void, InvalidAnalysisTransition> {
    const current = this.state.analysis
    if (current.status !== 'queued') return this.invalidAnalysis("L'analyse doit être en file d'attente pour démarrer.")
    return this.setAnalysis({ status: 'running', requestedAt: current.requestedAt, startedAt: now, activity: null })
  }

  /** Ignored unless an analysis is running: activity reports may arrive late. */
  reportActivity(activity: string): void {
    const current = this.state.analysis
    if (current.status === 'running') this.state = { ...this.state, analysis: { ...current, activity } }
  }

  /** A new brief makes the personas and the videos made from the previous one obsolete. */
  completeAnalysis(brief: ProductBrief, now: Date): Result<void, InvalidAnalysisTransition> {
    if (this.state.analysis.status !== 'running') return this.invalidAnalysis("Aucune analyse n'est en cours.")
    this.state = { ...this.state, personas: { status: 'not_started' }, videos: [], styles: [] }
    return this.setAnalysis({ status: 'succeeded', brief, completedAt: now })
  }

  failAnalysis(reason: string, now: Date): Result<void, InvalidAnalysisTransition> {
    if (!this.isBeingAnalysed) return this.invalidAnalysis("Aucune analyse n'est en cours.")
    return this.setAnalysis({ status: 'failed', reason, failedAt: now })
  }

  // ── Personas ──────────────────────────────────────────────────────────────

  /** Personas are written from the brief: there must be one, and nothing else pending. */
  requestPersonas(now: Date): Result<void, BriefRequired | InvalidPersonasTransition> {
    if (isPending(this.state.personas)) return this.invalidPersonas('Les personas sont déjà en cours de rédaction.')
    if (this.isBeingAnalysed) return this.invalidPersonas("Attendez la fin de l'analyse du code.")
    if (this.hasPendingVideo) return this.invalidPersonas('Attendez la fin des vidéos en cours.')
    if (!this.brief) {
      return err({ type: 'BriefRequired', message: "Les personas s'appuient sur le brief produit : lancez d'abord l'analyse." })
    }
    return this.setPersonas({ status: 'queued', requestedAt: now })
  }

  startPersonas(now: Date): Result<void, InvalidPersonasTransition> {
    const current = this.state.personas
    if (current.status !== 'queued') return this.invalidPersonas("Les personas doivent être en file d'attente pour démarrer.")
    return this.setPersonas({ status: 'running', requestedAt: current.requestedAt, startedAt: now })
  }

  /** New personas make the videos and the styles of the previous ones obsolete. */
  completePersonas(personas: Personas, now: Date): Result<void, InvalidPersonasTransition> {
    if (this.state.personas.status !== 'running') return this.invalidPersonas("Aucune rédaction de personas n'est en cours.")
    this.state = { ...this.state, videos: [], styles: [] }
    return this.setPersonas({ status: 'succeeded', personas, completedAt: now })
  }

  failPersonas(reason: string, now: Date): Result<void, InvalidPersonasTransition> {
    if (!isPending(this.state.personas)) return this.invalidPersonas("Aucune rédaction de personas n'est en cours.")
    return this.setPersonas({ status: 'failed', reason, failedAt: now })
  }

  // ── Videos ────────────────────────────────────────────────────────────────

  /** A video is made for one persona: they must exist, and nothing that would replace them may be pending. */
  requestVideo(persona: string, now: Date): Result<void, PersonaNotFound | InvalidVideoTransition> {
    if (!this.persona(persona)) {
      return err({ type: 'PersonaNotFound', message: `Le persona « ${persona} » n'existe pas dans ce projet.` })
    }
    if (isPending(this.state.analysis) || isPending(this.state.personas)) {
      return this.invalidVideo(persona, 'Attendez la fin du travail en cours sur ce projet.')
    }
    const current = this.videoOf(persona)
    if (current && isPending(current)) return this.invalidVideo(persona, 'Cette vidéo est déjà en cours de production.')
    const direction = VideoDirection.of(this.styleOf(persona), this.state.videoSetup)
    // New scripts are written: those of the previous request are dropped.
    return this.setVideo(persona, { status: 'queued', requestedAt: now, direction }, null)
  }

  /** The scripts are ready: the video waits for the user to pick one. */
  offerScripts(persona: string, scripts: ScriptSet, now: Date): Result<void, InvalidVideoTransition> {
    const current = this.videoOf(persona)
    if (current?.status !== 'running') return this.invalidVideo(persona, "Cette vidéo n'est pas en cours d'écriture.")
    return this.setVideo(persona, { status: 'scripted', direction: current.direction, requestedAt: current.requestedAt, scriptedAt: now }, scripts)
  }

  /** The scripts written for that persona's video, and the one chosen. */
  scriptsOf(persona: string): ScriptSet | null {
    return this.state.videos.find((video) => video.persona === persona)?.scripts ?? null
  }

  /**
   * The user picks one of the scripts, with their own words if they changed them, and the
   * video is made from it. Possible once they are written, and again once the video is made.
   */
  chooseScript(
    persona: string,
    choice: { readonly index: number; readonly texts: readonly string[] | null },
    now: Date,
  ): Result<void, PersonaNotFound | InvalidVideoTransition | InvalidScript> {
    const brief = this.brief
    if (!this.persona(persona) || !brief) {
      return err({ type: 'PersonaNotFound', message: `Le persona « ${persona} » n'existe pas dans ce projet.` })
    }
    if (isPending(this.state.analysis) || isPending(this.state.personas)) {
      return this.invalidVideo(persona, 'Attendez la fin du travail en cours sur ce projet.')
    }
    const current = this.videoOf(persona)
    const scripts = this.scriptsOf(persona)
    if (!current || isPending(current)) return this.invalidVideo(persona, 'Cette vidéo est déjà en cours de production.')
    if (!scripts) return this.invalidVideo(persona, "Aucun script n'a été écrit pour cette vidéo.")

    const chosen = scripts.choose(choice.index, choice.texts, brief)
    if (!chosen.ok) return chosen
    // Made in the direction the scripts were written for: their tone, the pages they show.
    return this.setVideo(persona, { status: 'queued', requestedAt: now, direction: scripts.props.direction }, chosen.value)
  }

  startVideo(persona: string, now: Date): Result<void, InvalidVideoTransition> {
    const current = this.videoOf(persona)
    if (current?.status !== 'queued') return this.invalidVideo(persona, "La vidéo doit être en file d'attente pour démarrer.")
    return this.setVideo(persona, {
      status: 'running',
      direction: current.direction,
      requestedAt: current.requestedAt,
      startedAt: now,
      step: this.firstStep(persona, current.direction),
      progress: null,
      activity: null,
    })
  }

  /** Where a video starts: from the chosen script if there is one, else from filming the application or writing. */
  private firstStep(persona: string, direction: VideoDirection): VideoStep {
    if (this.scriptsOf(persona)?.props.chosen) return direction.props.production === 'directed' ? 'direct' : 'storyboard'
    return ({ auto: 'scout', pages: 'capture', none: 'script' } as const)[direction.props.demo.mode]
  }

  /** Ignored unless that video is running: progress reports may arrive late. */
  reportVideoProgress(persona: string, step: VideoStep, progress: number | null): void {
    const current = this.videoOf(persona)
    if (current?.status === 'running') this.setVideo(persona, { ...current, step, progress, activity: step === current.step ? current.activity : null })
  }

  /** What Claude is doing on that video. Ignored unless it is running. */
  reportVideoActivity(persona: string, activity: string): void {
    const current = this.videoOf(persona)
    if (current?.status === 'running') this.setVideo(persona, { ...current, activity })
  }

  completeVideo(
    persona: string,
    video: { work: VideoWork; file: string; seconds: number },
    now: Date,
  ): Result<void, InvalidVideoTransition> {
    const current = this.videoOf(persona)
    if (current?.status !== 'running') return this.invalidVideo(persona, "Cette vidéo n'est pas en cours de production.")
    return this.setVideo(persona, { status: 'succeeded', direction: current.direction, ...video, completedAt: now })
  }

  failVideo(persona: string, reason: string, now: Date): Result<void, InvalidVideoTransition> {
    const current = this.videoOf(persona)
    if (!current || !isPending(current)) return this.invalidVideo(persona, "Cette vidéo n'est pas en cours de production.")
    return this.setVideo(persona, { status: 'failed', reason, failedAt: now })
  }

  /** Marks every pending video as failed, e.g. after the application was stopped. */
  failPendingVideos(reason: string, now: Date): void {
    for (const video of this.state.videos) {
      if (isPending(video.state)) this.setVideo(video.persona, { status: 'failed', reason, failedAt: now })
    }
  }

  toSnapshot(): ProjectSnapshot {
    return this.state
  }

  private videoOf(persona: string): VideoState | null {
    return this.state.videos.find((video) => video.persona === persona)?.state ?? null
  }

  /** `scripts` undefined: those already written for that video are kept. */
  private setVideo(persona: string, state: VideoState, scripts?: ScriptSet | null): Result<void, never> {
    const kept = scripts === undefined ? this.scriptsOf(persona) : scripts
    const others = this.state.videos.filter((video) => video.persona !== persona)
    this.state = { ...this.state, videos: [...others, { persona, state, scripts: kept }] }
    return okVoid
  }

  private invalidVideo(persona: string, message: string) {
    return err<InvalidVideoTransition>({
      type: 'InvalidVideoTransition',
      message,
      from: this.videoOf(persona)?.status ?? 'not_started',
    })
  }

  private setAnalysis(analysis: AnalysisState): Result<void, never> {
    this.state = { ...this.state, analysis }
    return okVoid
  }

  private setPersonas(personas: PersonasState): Result<void, never> {
    this.state = { ...this.state, personas }
    return okVoid
  }

  private invalidAnalysis(message: string) {
    return err<InvalidAnalysisTransition>({ type: 'InvalidAnalysisTransition', message, from: this.state.analysis.status })
  }

  private invalidPersonas(message: string) {
    return err<InvalidPersonasTransition>({ type: 'InvalidPersonasTransition', message, from: this.state.personas.status })
  }
}
