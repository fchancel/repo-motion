import type {
  ClaudeCode,
  ClaudeCodeStatus,
  CodebaseAnalysisFailed,
  CodebaseAnalysisRequest,
  CodebaseAnalyzer,
  PersonaWriter,
  PersonaWritingFailed,
  PersonaWritingRequest,
} from '../application/ports/claude-code'
import type { FolderNotFound, ProjectFolders } from '../application/ports/project-folders'
import type {
  VideoDirectingFailed,
  VideoDirectingRequest,
  VideoDirector,
  PersonaStyleSuggestion,
  StyleAdvisor,
  StyleSuggestionFailed,
  StyleSuggestionRequest,
  DemoScout,
  DemoScoutingFailed,
  DemoScoutingRequest,
  AppCapturer,
  AppCaptureFailed,
  AppCaptureRequest,
  AudioTracks,
  ScriptWriter,
  ScriptWritingFailed,
  ScriptWritingRequest,
  StoryboardWriter,
  StoryboardWritingFailed,
  StoryboardWritingRequest,
  VideoRenderer,
  VideoRenderingFailed,
  VideoRenderRequest,
} from '../application/ports/video'
import { ProductBrief } from '../domain/analysis/product-brief'
import { Personas } from '../domain/persona/persona'
import type { ProjectId } from '../domain/project/project'
import { ProjectFolder } from '../domain/project/project-folder'
import { DirectedPiece } from '../domain/video/piece'
import { Script } from '../domain/video/script'
import { Storyboard, type Scene } from '../domain/video/storyboard'
import { err, ok } from '../shared/result'
import { aPersonaDraft, aPieceDraft, aProductBriefDraft, aScriptDraft, aStoryboardDraft, aViewerTest } from './fixtures'

export class FakeClaudeCode implements ClaudeCode {
  current: ClaudeCodeStatus = { state: 'ready', version: '2.1.0', executable: 'claude' }

  async status(): Promise<ClaudeCodeStatus> {
    return this.current
  }
}

/** Knows a fixed set of folders, given as absolute paths. `~` stands for `/home/ada`. */
export class FakeProjectFolders implements ProjectFolders {
  constructor(private readonly existing: string[] = []) {}

  async resolve(input: string) {
    const path = input.trim().replace(/^~/, '/home/ada').replace(/\/+$/, '')
    const folder = ProjectFolder.of(path)
    if (!folder.ok || !this.existing.includes(folder.value.path)) {
      return err<FolderNotFound>({ type: 'FolderNotFound', message: `Le dossier « ${input} » est introuvable.` })
    }
    return ok(folder.value)
  }

  async suggest(input: string): Promise<string[]> {
    return this.existing.filter((path) => path.startsWith(input))
  }
}

export class FakeCodebaseAnalyzer implements CodebaseAnalyzer {
  readonly requests: CodebaseAnalysisRequest[] = []
  /** Activity reported during the next analyses. */
  activity: string[] = []
  private nextFailure: CodebaseAnalysisFailed | null = null

  failNextWith(message: string): void {
    this.nextFailure = { type: 'CodebaseAnalysisFailed', message, retryable: false }
  }

  async analyze(request: CodebaseAnalysisRequest) {
    this.requests.push(request)
    for (const step of this.activity) request.onActivity?.(step)

    if (this.nextFailure) {
      const failure = this.nextFailure
      this.nextFailure = null
      return err(failure)
    }
    const brief = ProductBrief.create(aProductBriefDraft())
    if (!brief.ok) throw new Error('Invalid fixture')
    return ok(brief.value)
  }
}

export class FakePersonaWriter implements PersonaWriter {
  readonly requests: PersonaWritingRequest[] = []
  private nextFailure: PersonaWritingFailed | null = null

  failNextWith(message: string): void {
    this.nextFailure = { type: 'PersonaWritingFailed', message, retryable: false }
  }

  async write(request: PersonaWritingRequest) {
    this.requests.push(request)
    if (this.nextFailure) {
      const failure = this.nextFailure
      this.nextFailure = null
      return err(failure)
    }
    const personas = Personas.create([aPersonaDraft(), aPersonaDraft({ name: 'Marc', audience: 'Amateurs de quiz' })], request.brief)
    if (!personas.ok) throw new Error(`Invalid fixture: ${personas.error.violations.join(' ')}`)
    return ok(personas.value)
  }
}

/** Writes two tested scripts, the second one better, and recommends it. */
export class FakeScriptWriter implements ScriptWriter {
  readonly requests: ScriptWritingRequest[] = []
  /** What the writing says it is doing during the next requests. */
  activity: string[] = []
  private nextFailure: ScriptWritingFailed | null = null

  failNextWith(message: string): void {
    this.nextFailure = { type: 'ScriptWritingFailed', message, retryable: false }
  }

  async write(request: ScriptWritingRequest) {
    this.requests.push(request)
    for (const step of this.activity) request.onActivity?.(step)
    if (this.nextFailure) {
      const failure = this.nextFailure
      this.nextFailure = null
      return err(failure)
    }
    const drafts = [aScriptDraft({ format: 'problem-solution', openLoop: null }), aScriptDraft()]
    const candidates = drafts.map((draft, index) => {
      const script = Script.create(draft, request.brief)
      if (!script.ok) throw new Error(`Invalid fixture: ${script.error.violations.join(' ')}`)
      return script.value.tested(aViewerTest(index === 0 ? { leftAt: 2, scores: { hook: 4, clarity: 6, retention: 3 } } : {}))
    })
    return ok({ candidates, recommended: 1 })
  }
}

export class FakeStoryboardWriter implements StoryboardWriter {
  readonly requests: StoryboardWritingRequest[] = []
  private nextFailure: StoryboardWritingFailed | null = null

  failNextWith(message: string): void {
    this.nextFailure = { type: 'StoryboardWritingFailed', message, retryable: false }
  }

  async write(request: StoryboardWritingRequest) {
    this.requests.push(request)
    if (this.nextFailure) {
      const failure = this.nextFailure
      this.nextFailure = null
      return err(failure)
    }
    const draft = aStoryboardDraft()
    // A video that shows the application gets its demo shot, right after the product is revealed.
    const scenes = draft.scenes.flatMap((scene): Scene[] =>
      scene.kind === 'reveal' && request.direction.showsDemo ? [scene, { kind: 'demo', caption: 'Voilà à quoi ça *ressemble*.' }] : [scene],
    )
    const storyboard = Storyboard.create({ ...draft, scenes }, request.persona, request.brief, { demo: request.direction.showsDemo })
    if (!storyboard.ok) throw new Error(`Invalid fixture: ${storyboard.error.violations.join(' ')}`)
    return ok(storyboard.value)
  }
}

export class FakeVideoRenderer implements VideoRenderer {
  readonly requests: VideoRenderRequest[] = []
  readonly discarded: ProjectId[] = []
  /** Progress reported during the next renders. */
  progress: number[] = []
  private nextFailure: VideoRenderingFailed | null = null

  failNextWith(message: string): void {
    this.nextFailure = { type: 'VideoRenderingFailed', message }
  }

  async render(request: VideoRenderRequest) {
    this.requests.push(request)
    for (const step of this.progress) request.onProgress?.(step)

    if (this.nextFailure) {
      const failure = this.nextFailure
      this.nextFailure = null
      return err(failure)
    }
    // A storyboard knows how long it lasts; a directed piece is as long as its code says.
    const seconds = request.source.kind === 'storyboard' ? request.source.storyboard.seconds : 18
    return ok({ file: `/videos/${request.projectId}/${request.persona}.mp4`, seconds })
  }

  async discard(projectId: ProjectId): Promise<void> {
    this.discarded.push(projectId)
  }
}

export class FakeAppCapturer implements AppCapturer {
  readonly requests: AppCaptureRequest[] = []
  readonly discarded: ProjectId[] = []
  /** Addresses that do not open. */
  missing: string[] = []
  private nextFailure: AppCaptureFailed | null = null

  failNextWith(message: string): void {
    this.nextFailure = { type: 'AppCaptureFailed', message }
  }

  async capture(request: AppCaptureRequest) {
    this.requests.push(request)
    if (this.nextFailure) {
      const failure = this.nextFailure
      this.nextFailure = null
      return err(failure)
    }
    // Pages listed in `missing` do not open: a lenient capture leaves them out, a strict one fails.
    const opened = request.addresses.filter((address) => !this.missing.includes(address))
    if (opened.length === 0 || (!request.lenient && opened.length < request.addresses.length)) {
      return err<AppCaptureFailed>({ type: 'AppCaptureFailed', message: 'Une page ne répond pas.' })
    }
    return ok(opened.map((address, index) => ({ address, title: `Page ${index + 1}`, file: `/captures/${request.projectId}/${request.take}/${index}.jpg` })))
  }

  async discard(projectId: ProjectId): Promise<void> {
    this.discarded.push(projectId)
  }
}

/** Knows a fixed set of audio files. `~` stands for `/home/ada`. */
export class FakeAudioTracks implements AudioTracks {
  constructor(private readonly existing: string[] = ['/home/ada/Music/beat.mp3']) {}

  async resolve(input: string) {
    const path = input.trim().replace(/^~/, '/home/ada')
    return this.existing.includes(path)
      ? ok(path)
      : err({ type: 'TrackNotFound' as const, message: `Le fichier audio « ${input} » est introuvable.` })
  }
}

export class FakeDemoScout implements DemoScout {
  readonly requests: DemoScoutingRequest[] = []
  /** What Claude proposes to film. */
  pages = [
    { path: '/', shows: "L'accueil et le défi du jour" },
    { path: '/classement', shows: 'Le classement des joueurs' },
  ]
  private nextFailure: DemoScoutingFailed | null = null

  failNextWith(message: string): void {
    this.nextFailure = { type: 'DemoScoutingFailed', message, retryable: false }
  }

  async scout(request: DemoScoutingRequest) {
    this.requests.push(request)
    if (this.nextFailure) {
      const failure = this.nextFailure
      this.nextFailure = null
      return err(failure)
    }
    return ok({ pages: this.pages, language: 'fr' })
  }
}

/** Proposes a neon look in a daring tone to the first persona, a pop one in Gen Z voice to the next, and so on. */
export class FakeStyleAdvisor implements StyleAdvisor {
  readonly requests: StyleSuggestionRequest[] = []
  private nextFailure: StyleSuggestionFailed | null = null

  failNextWith(message: string): void {
    this.nextFailure = { type: 'StyleSuggestionFailed', message, retryable: false }
  }

  async suggest(request: StyleSuggestionRequest) {
    this.requests.push(request)
    if (this.nextFailure) {
      const failure = this.nextFailure
      this.nextFailure = null
      return err(failure)
    }
    return ok(
      request.personas.all.map((persona, index): PersonaStyleSuggestion =>
        index % 2 === 0
          ? { persona: persona.name, look: 'neon', tone: 'dare', sound: 'beat', reason: 'Joue le soir, aime la compétition.' }
          : { persona: persona.name, look: 'pop', tone: 'genz', sound: 'effects', reason: 'Jeune, sur TikTok.' },
      ),
    )
  }
}

export class FakeVideoDirector implements VideoDirector {
  readonly requests: VideoDirectingRequest[] = []
  readonly discarded: ProjectId[] = []
  /** What Claude says it is doing during the next directions. */
  activity: string[] = []
  private nextFailure: VideoDirectingFailed | null = null

  failNextWith(message: string): void {
    this.nextFailure = { type: 'VideoDirectingFailed', message, retryable: false }
  }

  async direct(request: VideoDirectingRequest) {
    this.requests.push(request)
    for (const step of this.activity) request.onActivity?.(step)
    if (this.nextFailure) {
      const failure = this.nextFailure
      this.nextFailure = null
      return err(failure)
    }
    const piece = DirectedPiece.create(aPieceDraft(), request.persona)
    if (!piece.ok) throw new Error(`Invalid fixture: ${piece.error.violations.join(' ')}`)
    return ok({ piece: piece.value, workspace: `/studio/${request.projectId}/${request.persona.name}` })
  }

  async discard(projectId: ProjectId): Promise<void> {
    this.discarded.push(projectId)
  }
}
