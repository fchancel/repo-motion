import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DirectedPiece, Personas, ProductBrief, Project, ProjectFolder, ProjectId, Script, ScriptSet, Storyboard, VideoDirection, VideoSetup, type BackgroundJob } from '@repo-motion/core'
import { aPersonaDraft, aPieceDraft, aProductBriefDraft, aScriptDraft, aStoryboardDraft, aViewerTest } from '@repo-motion/core/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NodeAudioTracks } from './filesystem/node-audio-tracks'
import { NodeProjectFolders } from './filesystem/node-project-folders'
import { FileProjectRepository } from './persistence/file-project-repository'
import { InProcessBackgroundJobs } from './queue/in-process-background-jobs'

/** Real file system, in a throwaway folder. */
let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'repo-motion-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const now = new Date('2026-01-01T10:00:00.000Z')

const aProject = (id: string, path = '/home/ada/app', createdAt = now) => {
  const folder = ProjectFolder.of(path)
  if (!folder.ok) throw new Error('fixture')
  return Project.add({ id: ProjectId(id), folder: folder.value, now: createdAt })
}

describe('FileProjectRepository', () => {
  it('round-trips every analysis state, including the brief', async () => {
    const projects = new FileProjectRepository(join(root, 'projects'))
    const project = aProject('p1')
    const brief = ProductBrief.create(aProductBriefDraft())
    if (!brief.ok) throw new Error('fixture')

    const check = async () => {
      await projects.save(project)
      const reloaded = (await projects.findById(project.id))?.toSnapshot()
      expect(reloaded?.analysis).toEqual(project.analysis)
      expect(reloaded?.personas).toEqual(project.personas)
      expect(reloaded?.folder.path).toBe('/home/ada/app')
      expect(reloaded?.createdAt).toEqual(now)
    }

    await check()
    project.requestAnalysis(now)
    await check()
    project.startAnalysis(now)
    project.reportActivity('Lecture de README.md')
    await check()
    project.completeAnalysis(brief.value, now)
    await check()

    const personas = Personas.create([aPersonaDraft(), aPersonaDraft({ name: 'Marc' })], brief.value)
    if (!personas.ok) throw new Error('fixture')
    project.requestPersonas(now)
    await check()
    project.startPersonas(now)
    await check()
    project.completePersonas(personas.value, now)
    await check()
  })

  /** A project with a brief and two personas: Léa and Marc. */
  const withPersonas = (id: string) => {
    const project = aProject(id)
    const brief = ProductBrief.create(aProductBriefDraft())
    if (!brief.ok) throw new Error('fixture')
    const personas = Personas.create([aPersonaDraft(), aPersonaDraft({ name: 'Marc' })], brief.value)
    const lea = personas.ok ? personas.value.all[0] : undefined
    if (!personas.ok || !lea) throw new Error('fixture')

    project.requestAnalysis(now)
    project.startAnalysis(now)
    project.completeAnalysis(brief.value, now)
    project.requestPersonas(now)
    project.startPersonas(now)
    project.completePersonas(personas.value, now)

    const storyboard = Storyboard.create(aStoryboardDraft(), lea, brief.value)
    const piece = DirectedPiece.create(aPieceDraft(), lea)
    if (!storyboard.ok || !piece.ok) throw new Error('fixture')
    return { project, storyboard: storyboard.value, piece: piece.value }
  }

  it('round-trips every state of a video, including its storyboard', async () => {
    const projects = new FileProjectRepository(join(root, 'projects'))
    const { project, storyboard, piece } = withPersonas('p1')

    const check = async () => {
      await projects.save(project)
      expect((await projects.findById(project.id))?.videos).toEqual(project.videos)
    }

    // Léa has a style Claude proposed and one the user chose; Marc has neither.
    const setup = VideoSetup.create({ production: 'template', demo: { mode: 'auto', addresses: ['http://localhost:5173'] }, track: '/home/ada/Music/beat.mp3' })
    if (!setup.ok) throw new Error('fixture')
    project.setUpVideos(setup.value)
    project.suggestStyles([{ persona: 'Léa', look: 'pop', tone: 'genz', sound: 'effects', reason: 'Elle révise sur TikTok.' }])
    project.chooseStyle('Léa', { look: 'neon', tone: 'trailer', sound: 'track' })
    project.requestVideo('Léa', now)
    project.requestVideo('Marc', now)
    await check()

    const reloaded = await projects.findById(project.id)
    expect(reloaded?.videoSetup).toEqual(setup.value)
    expect(reloaded?.personaStyles).toEqual(project.personaStyles)
    expect(reloaded?.styleOf('Léa')).toEqual({ look: 'neon', tone: 'trailer', sound: 'track' })
    project.startVideo('Léa', now)
    project.reportVideoProgress('Léa', 'render', 0.4)
    await check()
    project.completeVideo('Léa', { work: { kind: 'storyboard', storyboard }, file: '/videos/p1/lea.mp4', seconds: 19.2 }, now)
    project.failVideo('Marc', 'Limite atteinte', now)
    await check()

    // A video Claude directs says what it is doing, and ends as a piece rather than a storyboard.
    project.requestVideo('Marc', now)
    project.startVideo('Marc', now)
    project.reportVideoProgress('Marc', 'direct', null)
    project.reportVideoActivity('Marc', 'Tire une planche de ses images')
    await check()
    project.completeVideo('Marc', { work: { kind: 'piece', piece }, file: '/videos/p1/marc.mp4', seconds: 18 }, now)
    await check()
  })

  it('round-trips the scripts of a video: offered, tested, then chosen with the user’s own words', async () => {
    const projects = new FileProjectRepository(join(root, 'projects'))
    const { project } = withPersonas('p1')
    const brief = project.brief
    const script = brief ? Script.create(aScriptDraft(), brief) : null
    if (!brief || !script?.ok) throw new Error('fixture')
    const screens = [{ address: 'http://localhost:5173/', title: 'Accueil', shows: null, file: '/captures/p1/0.jpg' }]

    project.requestVideo('Léa', now)
    project.startVideo('Léa', now)
    project.offerScripts('Léa', ScriptSet.of({ candidates: [script.value.tested(aViewerTest()), script.value], recommended: 0, direction: VideoDirection.default(), screens, writtenAt: now }), now)
    await projects.save(project)
    expect((await projects.findById(project.id))?.videos).toEqual(project.videos)

    const texts = script.value.props.beats.map((beat) => beat.onScreen).with(2, 'Le même défi pour toute ta classe, chaque matin.')
    expect(project.chooseScript('Léa', { index: 0, texts }, now).ok).toBe(true)
    await projects.save(project)
    const reloaded = await projects.findById(project.id)
    expect(reloaded?.videos).toEqual(project.videos)
    expect(reloaded?.scriptsOf('Léa')?.props.chosen?.script.props).toMatchObject({ edited: true, test: aViewerTest() })
  })

  it('applies updates of one project one after the other, so none is lost', async () => {
    const projects = new FileProjectRepository(join(root, 'projects'))
    await projects.save(withPersonas('p1').project)

    // Two videos of the same project, asked for at the same instant.
    const results = await Promise.all(
      ['Léa', 'Marc'].map((persona) => projects.update(ProjectId('p1'), (project) => project.requestVideo(persona, now).ok)),
    )

    expect(results).toEqual([true, true])
    expect((await projects.findById(ProjectId('p1')))?.videos.map((video) => video.persona).sort()).toEqual(['Léa', 'Marc'])
    expect(await projects.update(ProjectId('gone'), () => true)).toBeNull()
  })

  it('reads a project saved when the whole project had one look and one tone', async () => {
    const directory = join(root, 'projects')
    await mkdir(directory, { recursive: true })
    const demo = { mode: 'auto', addresses: ['http://localhost:5173'] }
    await writeFile(
      join(directory, 'old.json'),
      JSON.stringify({
        version: 1,
        id: 'old',
        folder: '/home/ada/app',
        createdAt: now.toISOString(),
        analysis: { status: 'not_started' },
        videoDirection: { look: 'impact', tone: 'pushy', sound: 'track', track: '/home/ada/Music/beat.mp3', demo },
      }),
    )

    const project = await new FileProjectRepository(directory).findById(ProjectId('old'))

    // What the videos share is kept; the look and the tone now belong to each persona.
    // A project set up before the choice existed has its next videos directed by Claude, like a new one.
    expect(project?.videoSetup.props).toEqual({ production: 'directed', demo, track: '/home/ada/Music/beat.mp3' })
    expect(project?.personaStyles).toEqual([])
  })

  it('reads a project saved when the demo was a plain list of pages', async () => {
    const directory = join(root, 'projects')
    await mkdir(directory, { recursive: true })
    const old = { look: 'impact', tone: 'pushy', sound: 'none', track: null }
    await writeFile(
      join(directory, 'old.json'),
      JSON.stringify({
        version: 1,
        id: 'old',
        folder: '/home/ada/app',
        createdAt: now.toISOString(),
        analysis: { status: 'not_started' },
        videos: [{ persona: 'Léa', state: { status: 'queued', requestedAt: now.toISOString(), direction: { ...old, demo: ['http://localhost:5173'] } } }],
        videoDirection: { ...old, demo: [] },
      }),
    )

    const project = await new FileProjectRepository(directory).findById(ProjectId('old'))
    const video = project?.videos[0]?.state

    expect(project?.videoSetup.props.demo).toEqual({ mode: 'none', addresses: [] })
    expect(video?.status === 'queued' && video.direction.props.demo).toEqual({ mode: 'pages', addresses: ['http://localhost:5173'] })
    // A video asked for before Claude could direct was to be assembled from ready-made shots.
    expect(video?.status === 'queued' && video.direction.props.production).toBe('template')
  })

  it('reads a project saved before personas existed', async () => {
    const directory = join(root, 'projects')
    await mkdir(directory, { recursive: true })
    await writeFile(
      join(directory, 'old.json'),
      JSON.stringify({ version: 1, id: 'old', folder: '/home/ada/app', createdAt: now.toISOString(), analysis: { status: 'not_started' } }),
    )

    const project = await new FileProjectRepository(directory).findById(ProjectId('old'))
    expect(project?.personas).toEqual({ status: 'not_started' })
    expect(project?.videos).toEqual([])
    expect(project?.videoSetup).toEqual(VideoSetup.default())
  })

  it('lists projects oldest first, and forgets removed ones', async () => {
    const projects = new FileProjectRepository(join(root, 'projects'))
    await projects.save(aProject('newer', '/home/ada/b', new Date('2026-02-01T00:00:00Z')))
    await projects.save(aProject('older', '/home/ada/a', new Date('2026-01-01T00:00:00Z')))

    expect((await projects.list()).map((project) => project.id)).toEqual(['older', 'newer'])

    await projects.remove(ProjectId('older'))
    expect((await projects.list()).map((project) => project.id)).toEqual(['newer'])
  })

  it('starts empty, ignores damaged files, and leaves no temporary file behind', async () => {
    const directory = join(root, 'projects')
    const projects = new FileProjectRepository(directory)
    expect(await projects.list()).toEqual([])

    await projects.save(aProject('p1'))
    await writeFile(join(directory, 'broken.json'), '{ not json')

    expect((await projects.list()).map((project) => project.id)).toEqual(['p1'])
    expect((await readdir(directory)).sort()).toEqual(['broken.json', 'p1.json'])
    expect(JSON.parse(await readFile(join(directory, 'p1.json'), 'utf8')).version).toBe(1)
  })

  it('never reads outside its folder', async () => {
    const projects = new FileProjectRepository(join(root, 'projects'))
    expect(await projects.findById(ProjectId('../../etc/passwd'))).toBeNull()
  })
})

describe('NodeAudioTracks', () => {
  it('finds an audio file from its full path, and says why another cannot be used', async () => {
    await writeFile(join(root, 'beat.mp3'), 'sound')
    await writeFile(join(root, 'notes.txt'), 'text')
    const tracks = new NodeAudioTracks()

    const found = await tracks.resolve(` ${join(root, 'beat.mp3')} `)
    const missing = await tracks.resolve(join(root, 'nope.mp3'))
    const notAudio = await tracks.resolve(join(root, 'notes.txt'))
    const relative = await tracks.resolve('beat.mp3')

    expect(found.ok && found.value).toBe(join(root, 'beat.mp3'))
    expect(missing.ok ? null : missing.error.message).toContain('est introuvable')
    expect(notAudio.ok ? null : notAudio.error.message).toContain('Formats acceptés')
    expect(relative.ok ? null : relative.error.message).toContain('chemin complet')
  })
})

describe('NodeProjectFolders', () => {
  const setup = async () => {
    const home = join(root, 'home')
    await mkdir(join(home, 'Projects', 'wiki-geo'), { recursive: true })
    await mkdir(join(home, 'Projects', 'widgets'))
    await mkdir(join(home, 'Projects', '.hidden'))
    await mkdir(join(home, 'Projects', 'node_modules'))
    await writeFile(join(home, 'Projects', 'wiki.txt'), '')
    return { home, folders: new NodeProjectFolders(join(home, 'Projects', 'wiki-geo'), home) }
  }

  it('resolves `~`, relative and absolute paths to the same folder', async () => {
    const { home, folders } = await setup()
    const resolved = await Promise.all([
      folders.resolve('~/Projects/wiki-geo/'),
      folders.resolve('.'),
      folders.resolve(join(home, 'Projects', 'widgets', '..', 'wiki-geo')),
    ])

    const paths = resolved.map((result) => (result.ok ? result.value.path : result.error.message))
    expect(new Set(paths).size).toBe(1)
    expect(paths[0]).toMatch(/wiki-geo$/)
  })

  it('refuses what is missing or is not a folder', async () => {
    const { folders } = await setup()
    const missing = await folders.resolve('~/Projects/nope')
    const file = await folders.resolve('~/Projects/wiki.txt')

    expect(missing.ok ? null : missing.error.message).toContain('introuvable')
    expect(file.ok ? null : file.error.message).toContain("n'est pas un dossier")
  })

  it('suggests the folders that complete what was typed', async () => {
    const { home, folders } = await setup()
    const names = async (input: string) => (await folders.suggest(input)).map((path) => path.replace(`${home}/`, ''))

    expect(await names('~/Projects/wi')).toEqual(['Projects/widgets', 'Projects/wiki-geo'])
    expect(await names('~/Projects/WIK')).toEqual(['Projects/wiki-geo'])
    expect(await names('~/Projects/')).toEqual(['Projects/widgets', 'Projects/wiki-geo'])
    expect(await names('~/nope/x')).toEqual([])
  })
})

describe('InProcessBackgroundJobs', () => {
  const job = (id: string): BackgroundJob => ({ kind: 'analysis', projectId: ProjectId(id) })

  it('runs every job, a few at a time', async () => {
    let active = 0
    let peak = 0
    const done: string[] = []
    const queue = new InProcessBackgroundJobs(async ({ projectId }) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      done.push(projectId)
    }, 2)

    for (const id of ['a', 'b', 'c', 'd', 'e']) await queue.enqueue(job(id))
    await queue.idle()

    expect(done.sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(peak).toBe(2)
  })

  it('keeps going after a job crashes', async () => {
    const done: string[] = []
    const errors = console.error
    console.error = () => undefined
    const queue = new InProcessBackgroundJobs(async ({ projectId }) => {
      if (projectId === 'bad') throw new Error('boom')
      done.push(projectId)
    }, 1)

    await queue.enqueue(job('bad'))
    await queue.enqueue(job('good'))
    await queue.idle()
    console.error = errors

    expect(done).toEqual(['good'])
  })
})
