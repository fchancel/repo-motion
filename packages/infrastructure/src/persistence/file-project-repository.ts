import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AnalysisState, AppScreen, DirectedPieceProps, Persona, PersonasState, ProductBriefProps, ProjectRepository, ScriptProps, StoryboardProps, VideoState, VideoWork } from '@repo-motion/core'
import { DEMO_MODES, DirectedPiece, LOOKS, Personas, PRODUCTIONS, ProductBrief, Project, ProjectFolder, ProjectId, Script, ScriptSet, SOUNDS, Storyboard, TONES, VideoDirection, VideoSetup } from '@repo-motion/core'
import { z } from 'zod'

/**
 * One JSON file per project, in the application's data folder. Enough for a local,
 * single-user application, and the user can read or delete the files themselves.
 */
const analysisSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not_started') }),
  z.object({ status: z.literal('queued'), requestedAt: z.string() }),
  z.object({ status: z.literal('running'), requestedAt: z.string(), startedAt: z.string(), activity: z.string().nullable() }),
  z.object({ status: z.literal('succeeded'), completedAt: z.string(), brief: z.custom<ProductBriefProps>((value) => typeof value === 'object' && value !== null) }),
  z.object({ status: z.literal('failed'), reason: z.string(), failedAt: z.string() }),
])

const personasSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not_started') }),
  z.object({ status: z.literal('queued'), requestedAt: z.string() }),
  z.object({ status: z.literal('running'), requestedAt: z.string(), startedAt: z.string() }),
  z.object({ status: z.literal('succeeded'), completedAt: z.string(), personas: z.array(z.custom<Persona>((value) => typeof value === 'object' && value !== null)) }),
  z.object({ status: z.literal('failed'), reason: z.string(), failedAt: z.string() }),
])

const directionSchema = z.object({
  look: z.enum(LOOKS),
  tone: z.enum(TONES),
  sound: z.enum(SOUNDS),
  track: z.string().nullable(),
  // Before Claude could direct a video, all of them were assembled from ready-made shots.
  production: z.enum(PRODUCTIONS).default('template'),
  demo: z.preprocess(
    // Before Claude could pick the pages, the demo was just the list of pages to film.
    (value) => (Array.isArray(value) ? { mode: value.length > 0 ? 'pages' : 'none', addresses: value } : value),
    z.object({ mode: z.enum(DEMO_MODES), addresses: z.array(z.string()) }),
  ),
})

/** Files written before videos could be directed: they were made with no choice at all. */
const direction = directionSchema.default(() => directionToFile(VideoDirection.default()))

const styleSchema = z.object({ look: z.enum(LOOKS), tone: z.enum(TONES), sound: z.enum(SOUNDS) })

/** What all the videos share. Until each persona had a style of their own, it was kept with a look, a tone and a sound. */
const setupSchema = directionSchema.pick({ demo: true, track: true }).extend({
  // A project set up before the choice existed gets what a new project gets: videos directed by Claude.
  production: z.enum(PRODUCTIONS).default('directed'),
})

const scriptSchema = z.custom<ScriptProps>((value) => typeof value === 'object' && value !== null && Array.isArray((value as { beats?: unknown }).beats))

/** The scripts written for a video, and the one the user chose. */
const scriptSetSchema = z.object({
  candidates: z.array(scriptSchema),
  recommended: z.number(),
  direction: directionSchema,
  screens: z.array(z.custom<AppScreen>((value) => typeof value === 'object' && value !== null)),
  chosen: z.object({ index: z.number(), script: scriptSchema }).nullable(),
  writtenAt: z.string(),
})

const videoSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('queued'), requestedAt: z.string(), direction }),
  z.object({
    status: z.literal('running'),
    requestedAt: z.string(),
    startedAt: z.string(),
    step: z.enum(['scout', 'capture', 'script', 'storyboard', 'direct', 'render']),
    progress: z.number().nullable(),
    activity: z.string().nullable().default(null),
    direction,
  }),
  z.object({
    status: z.literal('succeeded'),
    completedAt: z.string(),
    file: z.string(),
    seconds: z.number(),
    // One or the other: what the video was made from.
    storyboard: z.custom<StoryboardProps>((value) => typeof value === 'object' && value !== null).optional(),
    piece: z.custom<DirectedPieceProps>((value) => typeof value === 'object' && value !== null).optional(),
    direction,
  }),
  z.object({ status: z.literal('scripted'), requestedAt: z.string(), scriptedAt: z.string(), direction }),
  z.object({ status: z.literal('failed'), reason: z.string(), failedAt: z.string() }),
])

const fileSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  folder: z.string(),
  createdAt: z.string(),
  analysis: analysisSchema,
  // Absent from files written before personas existed.
  personas: personasSchema.default({ status: 'not_started' }),
  // Absent from files written before videos existed.
  // Videos made before scripts were written apart have none.
  videos: z.array(z.object({ persona: z.string(), state: videoSchema, scripts: scriptSetSchema.nullable().default(null) })).default([]),
  videoSetup: setupSchema.optional(),
  // Read only to recover the demo and the music of files written before `videoSetup` existed.
  videoDirection: setupSchema.optional(),
  styles: z
    .array(z.object({ persona: z.string(), suggestion: styleSchema.extend({ reason: z.string() }).nullable(), choice: styleSchema.nullable() }))
    .default([]),
})

type ProjectFile = z.infer<typeof fileSchema>

const SAFE_ID = /^[\w-]+$/

export class FileProjectRepository implements ProjectRepository {
  /** The last update of each project, so the next one waits for it. */
  private readonly updates = new Map<ProjectId, Promise<unknown>>()

  constructor(private readonly directory: string) {}

  async findById(id: ProjectId): Promise<Project | null> {
    if (!SAFE_ID.test(id)) return null
    return this.read(`${id}.json`)
  }

  async list(): Promise<Project[]> {
    const names = await readdir(this.directory).catch(() => [] as string[])
    const projects = await Promise.all(names.filter((name) => name.endsWith('.json')).map((name) => this.read(name)))
    return projects
      .filter((project): project is Project => project !== null)
      .sort((a, b) => a.toSnapshot().createdAt.getTime() - b.toSnapshot().createdAt.getTime())
  }

  async save(project: Project): Promise<void> {
    if (!SAFE_ID.test(project.id)) throw new Error(`Unsafe project id: ${project.id}`)
    await mkdir(this.directory, { recursive: true })

    // Write beside, then rename: a crash never leaves a half-written project.
    const target = join(this.directory, `${project.id}.json`)
    const temporary = `${target}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(toFile(project), null, 2), 'utf8')
    await rename(temporary, target)
  }

  async remove(id: ProjectId): Promise<void> {
    if (!SAFE_ID.test(id)) return
    await rm(join(this.directory, `${id}.json`), { force: true })
  }

  update<T>(id: ProjectId, change: (project: Project) => T): Promise<T | null> {
    const apply = async (): Promise<T | null> => {
      const project = await this.findById(id)
      if (!project) return null
      const result = change(project)
      await this.save(project)
      return result
    }

    // One update at a time per project, whatever happened to the previous one.
    const update = (this.updates.get(id) ?? Promise.resolve()).then(apply, apply)
    this.updates.set(id, update)
    void update
      .catch(() => undefined)
      .finally(() => {
        if (this.updates.get(id) === update) this.updates.delete(id)
      })
    return update
  }

  private async read(name: string): Promise<Project | null> {
    try {
      const parsed = fileSchema.safeParse(JSON.parse(await readFile(join(this.directory, name), 'utf8')))
      if (!parsed.success) {
        console.warn(`[projects] ${name} is not a valid project file and was ignored.`)
        return null
      }
      return toDomain(parsed.data)
    } catch {
      return null
    }
  }
}

const toFile = (project: Project): ProjectFile => {
  const { id, folder, analysis, personas, videos, videoSetup, styles, createdAt } = project.toSnapshot()
  return {
    version: 1,
    id,
    folder: folder.path,
    createdAt: createdAt.toISOString(),
    analysis: analysisToFile(analysis),
    personas: personasToFile(personas),
    videos: videos.map(({ persona, state, scripts }) => ({ persona, state: videoToFile(state), scripts: scripts ? scriptSetToFile(scripts) : null })),
    videoSetup: {
      production: videoSetup.props.production,
      demo: { mode: videoSetup.props.demo.mode, addresses: [...videoSetup.props.demo.addresses] },
      track: videoSetup.props.track,
    },
    styles: styles.map((style) => ({ ...style })),
  }
}

const toDomain = (file: ProjectFile): Project | null => {
  const folder = ProjectFolder.of(file.folder)
  if (!folder.ok) return null
  return Project.restore({
    id: ProjectId(file.id),
    folder: folder.value,
    analysis: analysisToDomain(file.analysis),
    personas: personasToDomain(file.personas),
    videos: file.videos.map(({ persona, state, scripts }) => ({ persona, state: videoToDomain(state), scripts: scripts ? scriptSetToDomain(scripts) : null })),
    videoSetup: VideoSetup.restore(file.videoSetup ?? file.videoDirection ?? VideoSetup.default().props),
    styles: file.styles,
    createdAt: new Date(file.createdAt),
  })
}

const analysisToFile = (state: AnalysisState): ProjectFile['analysis'] => {
  switch (state.status) {
    case 'not_started':
      return state
    case 'queued':
      return { status: 'queued', requestedAt: state.requestedAt.toISOString() }
    case 'running':
      return {
        status: 'running',
        requestedAt: state.requestedAt.toISOString(),
        startedAt: state.startedAt.toISOString(),
        activity: state.activity,
      }
    case 'succeeded':
      return { status: 'succeeded', brief: state.brief.props, completedAt: state.completedAt.toISOString() }
    case 'failed':
      return { status: 'failed', reason: state.reason, failedAt: state.failedAt.toISOString() }
  }
}

const analysisToDomain = (file: ProjectFile['analysis']): AnalysisState => {
  switch (file.status) {
    case 'not_started':
      return file
    case 'queued':
      return { status: 'queued', requestedAt: new Date(file.requestedAt) }
    case 'running':
      return {
        status: 'running',
        requestedAt: new Date(file.requestedAt),
        startedAt: new Date(file.startedAt),
        activity: file.activity,
      }
    case 'succeeded':
      return { status: 'succeeded', brief: ProductBrief.restore(file.brief), completedAt: new Date(file.completedAt) }
    case 'failed':
      return { status: 'failed', reason: file.reason, failedAt: new Date(file.failedAt) }
  }
}

const personasToFile = (state: PersonasState): ProjectFile['personas'] => {
  switch (state.status) {
    case 'not_started':
      return state
    case 'queued':
      return { status: 'queued', requestedAt: state.requestedAt.toISOString() }
    case 'running':
      return { status: 'running', requestedAt: state.requestedAt.toISOString(), startedAt: state.startedAt.toISOString() }
    case 'succeeded':
      return { status: 'succeeded', personas: [...state.personas.all], completedAt: state.completedAt.toISOString() }
    case 'failed':
      return { status: 'failed', reason: state.reason, failedAt: state.failedAt.toISOString() }
  }
}

const personasToDomain = (file: ProjectFile['personas']): PersonasState => {
  switch (file.status) {
    case 'not_started':
      return file
    case 'queued':
      return { status: 'queued', requestedAt: new Date(file.requestedAt) }
    case 'running':
      return { status: 'running', requestedAt: new Date(file.requestedAt), startedAt: new Date(file.startedAt) }
    case 'succeeded':
      return { status: 'succeeded', personas: Personas.restore(file.personas), completedAt: new Date(file.completedAt) }
    case 'failed':
      return { status: 'failed', reason: file.reason, failedAt: new Date(file.failedAt) }
  }
}

type VideoFile = ProjectFile['videos'][number]['state']

function directionToFile(direction: VideoDirection): z.infer<typeof directionSchema> {
  const { demo } = direction.props
  return { ...direction.props, demo: { mode: demo.mode, addresses: [...demo.addresses] } }
}

const videoToFile = (state: VideoState): VideoFile => {
  switch (state.status) {
    case 'queued':
      return { status: 'queued', requestedAt: state.requestedAt.toISOString(), direction: directionToFile(state.direction) }
    case 'running':
      return {
        status: 'running',
        requestedAt: state.requestedAt.toISOString(),
        startedAt: state.startedAt.toISOString(),
        step: state.step,
        progress: state.progress,
        activity: state.activity,
        direction: directionToFile(state.direction),
      }
    case 'succeeded':
      return {
        status: 'succeeded',
        direction: directionToFile(state.direction),
        ...(state.work.kind === 'piece' ? { piece: state.work.piece.props } : { storyboard: state.work.storyboard.props }),
        file: state.file,
        seconds: state.seconds,
        completedAt: state.completedAt.toISOString(),
      }
    case 'scripted':
      return {
        status: 'scripted',
        requestedAt: state.requestedAt.toISOString(),
        scriptedAt: state.scriptedAt.toISOString(),
        direction: directionToFile(state.direction),
      }
    case 'failed':
      return { status: 'failed', reason: state.reason, failedAt: state.failedAt.toISOString() }
  }
}

const videoToDomain = (file: VideoFile): VideoState => {
  switch (file.status) {
    case 'queued':
      return { status: 'queued', requestedAt: new Date(file.requestedAt), direction: VideoDirection.restore(file.direction) }
    case 'running':
      return {
        status: 'running',
        requestedAt: new Date(file.requestedAt),
        startedAt: new Date(file.startedAt),
        step: file.step,
        progress: file.progress,
        activity: file.activity,
        direction: VideoDirection.restore(file.direction),
      }
    case 'succeeded':
      return {
        status: 'succeeded',
        direction: VideoDirection.restore(file.direction),
        work: workToDomain(file),
        file: file.file,
        seconds: file.seconds,
        completedAt: new Date(file.completedAt),
      }
    case 'scripted':
      return {
        status: 'scripted',
        requestedAt: new Date(file.requestedAt),
        scriptedAt: new Date(file.scriptedAt),
        direction: VideoDirection.restore(file.direction),
      }
    case 'failed':
      return { status: 'failed', reason: file.reason, failedAt: new Date(file.failedAt) }
  }
}

type ScriptSetFile = z.infer<typeof scriptSetSchema>

const scriptSetToFile = (scripts: ScriptSet): ScriptSetFile => {
  const { candidates, recommended, direction, screens, chosen, writtenAt } = scripts.props
  return {
    candidates: candidates.map((script) => script.props),
    recommended,
    direction: directionToFile(direction),
    screens: [...screens],
    chosen: chosen ? { index: chosen.index, script: chosen.script.props } : null,
    writtenAt: writtenAt.toISOString(),
  }
}

const scriptSetToDomain = (file: ScriptSetFile): ScriptSet =>
  ScriptSet.restore({
    candidates: file.candidates.map((props) => Script.restore(props)),
    recommended: file.recommended,
    direction: VideoDirection.restore(file.direction),
    screens: file.screens,
    chosen: file.chosen ? { index: file.chosen.index, script: Script.restore(file.chosen.script) } : null,
    writtenAt: new Date(file.writtenAt),
  })

/** What a finished video was made from. A file with neither is damaged: it reads as an empty storyboard rather than not at all. */
const workToDomain = (file: Extract<VideoFile, { status: 'succeeded' }>): VideoWork =>
  file.piece
    ? { kind: 'piece', piece: DirectedPiece.restore(file.piece) }
    : { kind: 'storyboard', storyboard: Storyboard.restore(file.storyboard ?? { persona: '', scenes: [], post: { caption: '', hashtags: [] } }) }
