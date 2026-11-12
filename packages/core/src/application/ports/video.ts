import type { ProductBrief } from '../../domain/analysis/product-brief'
import type { Persona, Personas } from '../../domain/persona/persona'
import type { ProjectId } from '../../domain/project/project'
import type { ProjectFolder } from '../../domain/project/project-folder'
import type { AppScreen, DemoPage, StyleSuggestion, VideoDirection } from '../../domain/video/direction'
import type { DirectedPiece } from '../../domain/video/piece'
import type { Script } from '../../domain/video/script'
import type { Storyboard } from '../../domain/video/storyboard'
import type { Failure } from '../../shared/errors'
import type { Result } from '../../shared/result'

export interface ScriptWritingRequest {
  readonly brief: ProductBrief
  readonly persona: Persona
  /** The project's folder: Claude runs there, but writes from the brief and the persona alone. */
  readonly folder: ProjectFolder
  /** The tone to write in, and whether the video shows the application. */
  readonly direction: VideoDirection
  /** The pages filmed for the demo, when there is one: the scripts may build on them. */
  readonly screens: readonly AppScreen[]
  /** Called with a short description each time the writing moves on to a new stage. */
  readonly onActivity?: (activity: string) => void
}

export interface WrittenScripts {
  /** Each one tested on a viewer who knew nothing of the product. */
  readonly candidates: readonly Script[]
  /** The one the writers would make. */
  readonly recommended: number
}

export interface ScriptWritingFailed extends Failure<'ScriptWritingFailed'> {
  readonly retryable: boolean
}

/**
 * Writes several scripts for one persona's video, in different formats, has each of them
 * watched by a viewer who knows nothing of the product, and rewrites them where that viewer
 * got lost or left. Failures are returned, never thrown.
 */
export interface ScriptWriter {
  write(request: ScriptWritingRequest): Promise<Result<WrittenScripts, ScriptWritingFailed>>
}

export interface StoryboardWritingRequest {
  readonly brief: ProductBrief
  readonly persona: Persona
  /** The script the user chose: the storyboard puts its words into the ready-made shots. */
  readonly script: Script
  /** The project's folder: Claude runs there, but writes from the brief and the persona alone. */
  readonly folder: ProjectFolder
  /** The tone to write in, and whether the video shows the application. */
  readonly direction: VideoDirection
  /** The pages filmed for the demo, when there is one: the writer is told what is on them. */
  readonly screens: readonly AppScreen[]
}

export interface StoryboardWritingFailed extends Failure<'StoryboardWritingFailed'> {
  readonly retryable: boolean
}

/** Fits the chosen script into the ready-made shots. Failures are returned, never thrown. */
export interface StoryboardWriter {
  write(request: StoryboardWritingRequest): Promise<Result<Storyboard, StoryboardWritingFailed>>
}

export interface VideoRenderRequest {
  readonly projectId: ProjectId
  /** Where the product's own assets are, such as its logo. */
  readonly folder: ProjectFolder
  readonly brief: ProductBrief
  /** Whose video it is: each persona has one file. */
  readonly persona: string
  /** What to render: a storyboard to fill into the ready-made shots, or the workspace of a piece Claude directed. */
  readonly source: { readonly kind: 'storyboard'; readonly storyboard: Storyboard } | { readonly kind: 'piece'; readonly workspace: string }
  /** How it looks and what is heard. */
  readonly direction: VideoDirection
  /** The pages filmed for the demo, when there is one. */
  readonly screens: readonly AppScreen[]
  /** Called with a value from 0 to 1 as frames are rendered. */
  readonly onProgress?: (progress: number) => void
}

export interface RenderedVideo {
  /** Where the MP4 is on this machine. */
  readonly file: string
  readonly seconds: number
}

export type VideoRenderingFailed = Failure<'VideoRenderingFailed'>

/** Turns a storyboard into a vertical MP4 in the product's colours. Failures are returned, never thrown. */
export interface VideoRenderer {
  render(request: VideoRenderRequest): Promise<Result<RenderedVideo, VideoRenderingFailed>>
  /** Deletes every video rendered for that project. */
  discard(projectId: ProjectId): Promise<void>
}

export interface AppCaptureRequest {
  readonly projectId: ProjectId
  /** Whose video the pictures are for, and which of its takes this is: each has its own pictures. */
  readonly persona: string
  readonly take: 'home' | 'pages'
  /** The language to open the application in (`fr`, `en-GB`…). Null: the language of this computer. */
  readonly language: string | null
  /** The pages to photograph, in order. */
  readonly addresses: readonly string[]
  /**
   * True when Claude picked the pages: one that cannot be opened is left out, as long as
   * another can. False when the user listed them: they are told which one fails.
   */
  readonly lenient: boolean
}

/** A page as it was photographed. What it shows is known by whoever picked it, not by the camera. */
export type CapturedScreen = Omit<AppScreen, 'shows'>

export type AppCaptureFailed = Failure<'AppCaptureFailed'>

/**
 * Photographs pages of the application as it runs, the way a phone shows them.
 * Failures (the application is not running, a page does not load) are returned, never thrown.
 */
export interface AppCapturer {
  capture(request: AppCaptureRequest): Promise<Result<CapturedScreen[], AppCaptureFailed>>
  /** Deletes every picture taken for that project. */
  discard(projectId: ProjectId): Promise<void>
}

export type TrackNotFound = Failure<'TrackNotFound'>

/** Finds the audio file the user wants under their videos. */
export interface AudioTracks {
  /** Turns what the user typed (`~/Music/a.mp3`) into the path of an existing audio file. */
  resolve(input: string): Promise<Result<string, TrackNotFound>>
}

export interface DemoScoutingRequest {
  readonly folder: ProjectFolder
  readonly brief: ProductBrief
  /** The person the video is for: the pages are picked for what matters to them. */
  readonly persona: Persona
}

export interface DemoScoutingFailed extends Failure<'DemoScoutingFailed'> {
  readonly retryable: boolean
}

/**
 * Reads the application's code to pick the pages worth filming for one persona: pages
 * that exist, and that open without signing in. Failures are returned, never thrown.
 */
export interface DemoScouting {
  readonly pages: readonly DemoPage[]
  /** The language the video is written in, so that the application is filmed in it too. Null when unsure. */
  readonly language: string | null
}

export interface DemoScout {
  scout(request: DemoScoutingRequest): Promise<Result<DemoScouting, DemoScoutingFailed>>
}

export interface StyleSuggestionRequest {
  readonly brief: ProductBrief
  readonly personas: Personas
  /** The project's folder: Claude runs there, but works from the brief and the personas alone. */
  readonly folder: ProjectFolder
}

export interface StyleSuggestionFailed extends Failure<'StyleSuggestionFailed'> {
  readonly retryable: boolean
}

export type PersonaStyleSuggestion = StyleSuggestion & { readonly persona: string }

/**
 * Proposes, for each persona, how their video should look, speak and sound.
 * Failures are returned, never thrown.
 */
export interface StyleAdvisor {
  suggest(request: StyleSuggestionRequest): Promise<Result<PersonaStyleSuggestion[], StyleSuggestionFailed>>
}

export interface VideoDirectingRequest {
  readonly projectId: ProjectId
  readonly brief: ProductBrief
  readonly persona: Persona
  /** The script the user chose: what is read on screen, and when. The director makes it seen. */
  readonly script: Script
  /** Where the product's own assets are. */
  readonly folder: ProjectFolder
  /** The art direction, the tone, and whether the video has sound. */
  readonly direction: VideoDirection
  /** The pages filmed for the demo, when there is one. */
  readonly screens: readonly AppScreen[]
  /** Called with a short description each time Claude moves on to something new. */
  readonly onActivity?: (activity: string) => void
}

export interface DirectedVideo {
  readonly piece: DirectedPiece
  /** Where the video's code is on this machine: what the renderer renders. */
  readonly workspace: string
}

export interface VideoDirectingFailed extends Failure<'VideoDirectingFailed'> {
  readonly retryable: boolean
}

/**
 * Directs one persona's video from scratch: the idea, the script, the animation itself,
 * looking at its own frames and correcting them. Failures are returned, never thrown.
 */
export interface VideoDirector {
  direct(request: VideoDirectingRequest): Promise<Result<DirectedVideo, VideoDirectingFailed>>
  /** Deletes everything directed for that project. */
  discard(projectId: ProjectId): Promise<void>
}
