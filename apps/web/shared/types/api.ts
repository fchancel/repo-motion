/** HTTP contract between the local server and the browser. Plain JSON: no classes, dates as ISO strings. */

export type ClaudeCodeDto =
  | { state: 'missing' }
  | { state: 'signed_out'; version: string; executable: string }
  | { state: 'ready'; version: string; executable: string }

export interface SetupDto {
  claudeCode: ClaudeCodeDto
  /** The folder the application was launched from, offered as the first project. */
  launchFolder: string | null
}

export interface FeatureDto {
  name: string
  description: string
  userBenefit: string
  importance: 'core' | 'secondary'
}

export interface ProductBriefDto {
  productName: string
  tagline: string
  summary: string
  problem: string
  category: string
  audiences: string[]
  features: FeatureDto[]
  userJourneys: { name: string; steps: string[] }[]
  brand: {
    colors: { primary: string } & Record<'secondary' | 'accent' | 'background' | 'text', string | null>
    fonts: string[]
    logoPath: string | null
    voice: string
  }
  evidence: string[]
}

export type AnalysisDto =
  | { status: 'not_started' }
  | { status: 'queued'; requestedAt: string }
  | { status: 'running'; requestedAt: string; startedAt: string; activity: string | null }
  | { status: 'succeeded'; brief: ProductBriefDto; completedAt: string }
  | { status: 'failed'; reason: string; failedAt: string }

export type ChannelDto = 'tiktok' | 'instagram' | 'youtube' | 'linkedin'

export interface PersonaDto {
  name: string
  role: string
  audience: string
  situation: string
  pains: string[]
  goal: string
  objections: string[]
  keyFeatures: string[]
  vocabulary: string[]
  hook: string
  channels: ChannelDto[]
  /** Null for personas written before it was asked for. */
  rationale: string | null
}

export type PersonasDto =
  | { status: 'not_started' }
  | { status: 'queued'; requestedAt: string }
  | { status: 'running'; requestedAt: string; startedAt: string }
  | { status: 'succeeded'; personas: PersonaDto[]; completedAt: string }
  | { status: 'failed'; reason: string; failedAt: string }

/**
 * What a finished video is made of, shot by shot, whichever way it was made. Texts may
 * wrap the words the video highlights in *asterisks*.
 */
export interface VideoOutlineDto {
  /** The idea of the video, when Claude directed it. */
  concept: string | null
  shots: { label: string; texts: string[]; seconds: number }[]
  /** What to publish with the video. */
  post: { caption: string; hashtags: string[] }
}

export type LookDto = 'brand' | 'impact' | 'minimal' | 'neon' | 'gradient' | 'editorial' | 'terminal' | 'pop' | 'cinema' | 'retro' | 'collage'
export type ToneDto =
  | 'brand' | 'friendly' | 'expert' | 'funny' | 'pushy' | 'story' | 'pov' | 'provocative' | 'dare' | 'inspiring'
  | 'teacher' | 'reassuring' | 'sober' | 'premium' | 'ironic' | 'genz' | 'trailer' // prettier-ignore
export type SoundDto = 'none' | 'effects' | 'beat' | 'track'
/** `auto`: Claude picks the pages from the code. `pages`: the user lists them. */
export type DemoModeDto = 'none' | 'auto' | 'pages'

/** How one persona's video looks, speaks and sounds. */
export interface VideoStyleDto {
  look: LookDto
  tone: ToneDto
  sound: SoundDto
}

/** The style of one persona's next videos, and where it comes from. */
export interface PersonaStyleDto {
  persona: string
  /** What the next video will be made with: the user's choice, else Claude's proposal, else the default. */
  style: VideoStyleDto
  /** What Claude proposed, and why. Null until it has been asked. */
  suggestion: (VideoStyleDto & { reason: string }) | null
  /** True when the user chose something else than the proposal. */
  chosen: boolean
}

/** `directed`: Claude directs each video from scratch. `template`: it is assembled from ready-made shots. */
export type ProductionDto = 'directed' | 'template'

/** What all the videos of a project share. */
export interface VideoSetupDto {
  production: ProductionDto
  /** `auto`: `addresses` holds the one address where the application runs. `pages`: the pages to film. */
  demo: { mode: DemoModeDto; addresses: string[] }
  /** The user's own audio file, for the personas whose sound is `track`. */
  track: string | null
}

/** Everything one video was made with: its persona's style and the project's setup, at the time. */
export interface VideoDirectionDto extends VideoStyleDto, VideoSetupDto {}

export type ScriptFormatDto = 'play-along' | 'demo-first' | 'before-after' | 'myth' | 'pov' | 'list' | 'problem-solution' | 'challenge'
export type BeatRoleDto = 'hook' | 'context' | 'tension' | 'proof' | 'rehook' | 'payoff' | 'cta'

/** What a viewer who knew nothing of the product made of a script. */
export interface ViewerTestDto {
  whatItIs: string
  whatFor: string
  /** Seconds. Null: never understood. */
  understoodAt: number | null
  /** Seconds. Null: watched to the end. */
  leftAt: number | null
  why: string
  confusing: string[]
  scores: { hook: number; clarity: number; retention: number }
}

/** One way to tell a video, beat by beat. Texts may wrap the words the video highlights in *asterisks*. */
export interface ScriptDto {
  format: ScriptFormatDto
  angle: string
  /** The question the hook opens, which a later beat answers. */
  openLoop: string | null
  beats: { role: BeatRoleDto; onScreen: string; visual: string; seconds: number; start: number }[]
  seconds: number
  post: { caption: string; hashtags: string[] }
  test: ViewerTestDto | null
  /** `pass`: understood early and watched to the end. Null: not tested. */
  verdict: 'pass' | 'weak' | 'fail' | null
  /** The user changed its words after it was tested. */
  edited: boolean
}

/** The scripts written for one video, and the one chosen. */
export interface ScriptSetDto {
  candidates: ScriptDto[]
  recommended: number
  chosen: { index: number; script: ScriptDto } | null
  writtenAt: string
}

export type VideoDto =
  | { status: 'queued'; requestedAt: string; direction: VideoDirectionDto }
  | {
      status: 'running'
      requestedAt: string
      startedAt: string
      step: 'scout' | 'capture' | 'script' | 'storyboard' | 'direct' | 'render'
      progress: number | null
      /** What Claude is doing right now, while it directs. */
      activity: string | null
      direction: VideoDirectionDto
    }
  | { status: 'succeeded'; completedAt: string; seconds: number; url: string; outline: VideoOutlineDto; direction: VideoDirectionDto }
  /** The scripts are written: the user picks one. */
  | { status: 'scripted'; requestedAt: string; scriptedAt: string; direction: VideoDirectionDto }
  | { status: 'failed'; reason: string; failedAt: string }

export interface ProjectVideoDto {
  /** Name of the persona the video is for. */
  persona: string
  video: VideoDto
  /** The scripts written for it, kept after the video is made or has failed. */
  scripts: ScriptSetDto | null
}

export interface ProjectDto {
  id: string
  folder: { path: string; name: string }
  analysis: AnalysisDto
  personas: PersonasDto
  /** Only the personas a video was asked for. */
  videos: ProjectVideoDto[]
  videoSetup: VideoSetupDto
  /** One per persona, in the order of the personas. */
  styles: PersonaStyleDto[]
  createdAt: string
}

/** Body of every 4xx/5xx answered by the API. */
export interface ApiErrorData {
  type: string
  message: string
  projectId?: string
}
