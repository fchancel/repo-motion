import { beforeEach, describe, expect, it } from 'vitest'
import {
  FakeAppCapturer,
  FakeAudioTracks,
  FakeClaudeCode,
  FakeDemoScout,
  FakeCodebaseAnalyzer,
  FakeProjectFolders,
  FixedClock,
  FakePersonaWriter,
  FakeScriptWriter,
  FakeStoryboardWriter,
  FakeStyleAdvisor,
  FakeVideoDirector,
  FakeVideoRenderer,
  InMemoryBackgroundJobs,
  InMemoryProjectRepository,
  SequentialIds,
} from '../../testing'
import type { ProjectId } from '../../domain/project/project'
import { AddProject } from './add-project'
import { ChooseScript } from './choose-script'
import { ChooseStyle } from './choose-style'
import { ProduceVideo } from './produce-video'
import { GetProject, GetVideoFile, ListProjects } from './queries'
import { RecoverInterruptedWork } from './recover-interrupted-work'
import { RemoveProject } from './remove-project'
import { RequestAnalysis } from './request-analysis'
import { RequestPersonas } from './request-personas'
import { RequestVideo } from './request-video'
import { RunAnalysis } from './run-analysis'
import { SetUpVideos } from './set-up-videos'
import { SuggestStyles } from './suggest-styles'
import { WritePersonas } from './write-personas'

/** Drives the whole flow through the use cases, with in-memory adapters. */
const setup = () => {
  const deps = {
    projects: new InMemoryProjectRepository(),
    folders: new FakeProjectFolders(['/home/ada/app', '/home/ada/other']),
    jobs: new InMemoryBackgroundJobs(),
    claudeCode: new FakeClaudeCode(),
    analyzer: new FakeCodebaseAnalyzer(),
    personaWriter: new FakePersonaWriter(),
    scriptWriter: new FakeScriptWriter(),
    storyboardWriter: new FakeStoryboardWriter(),
    appCapturer: new FakeAppCapturer(),
    demoScout: new FakeDemoScout(),
    styleAdvisor: new FakeStyleAdvisor(),
    videoDirector: new FakeVideoDirector(),
    audioTracks: new FakeAudioTracks(),
    videoRenderer: new FakeVideoRenderer(),
    ids: new SequentialIds(),
    clock: new FixedClock(),
  }
  return {
    deps,
    addProject: new AddProject(deps),
    removeProject: new RemoveProject(deps),
    requestAnalysis: new RequestAnalysis(deps),
    runAnalysis: new RunAnalysis(deps),
    requestPersonas: new RequestPersonas(deps),
    writePersonas: new WritePersonas(deps),
    requestVideo: new RequestVideo(deps),
    chooseScript: new ChooseScript(deps),
    produceVideo: new ProduceVideo(deps),
    setUpVideos: new SetUpVideos(deps),
    chooseStyle: new ChooseStyle(deps),
    suggestStyles: new SuggestStyles(deps),
    getVideoFile: new GetVideoFile(deps),
    recover: new RecoverInterruptedWork(deps),
    getProject: new GetProject(deps),
    listProjects: new ListProjects(deps),
  }
}

describe('Analysis flow', () => {
  let app: ReturnType<typeof setup>

  beforeEach(() => {
    app = setup()
  })

  const addApp = async (): Promise<ProjectId> => {
    const added = await app.addProject.execute({ folder: '~/app' })
    if (!added.ok) throw new Error(added.error.message)
    return added.value.id
  }

  const analysisOf = async (projectId: ProjectId) => {
    const project = await app.getProject.execute({ projectId })
    if (!project.ok) throw new Error(project.error.message)
    return project.value.analysis
  }

  describe('adding a project', () => {
    it('resolves what the user typed into a folder', async () => {
      const added = await app.addProject.execute({ folder: '~/app/' })
      expect(added.ok && added.value.folder.path).toBe('/home/ada/app')
    })

    it('refuses a folder that does not exist', async () => {
      const added = await app.addProject.execute({ folder: '/nowhere' })
      expect(added.ok ? null : added.error.type).toBe('FolderNotFound')
    })

    it('refuses the same folder twice, and says which project has it', async () => {
      const projectId = await addApp()
      const again = await app.addProject.execute({ folder: '/home/ada/app' })

      expect(again.ok ? null : again.error).toMatchObject({ type: 'ProjectAlreadyAdded', projectId })
    })
  })

  describe('requesting an analysis', () => {
    it('queues it', async () => {
      const projectId = await addApp()
      const requested = await app.requestAnalysis.execute({ projectId })

      expect(requested.ok && requested.value.analysis.status).toBe('queued')
      expect(app.deps.jobs.enqueued).toEqual([{ kind: 'analysis', projectId }])
    })

    it.each(['missing', 'signed_out'] as const)('fails fast when Claude Code is %s', async (state) => {
      const projectId = await addApp()
      app.deps.claudeCode.current = state === 'missing' ? { state } : { state, version: '2.1.0', executable: 'claude' }

      const requested = await app.requestAnalysis.execute({ projectId })

      expect(requested.ok ? null : requested.error).toMatchObject({ type: 'ClaudeCodeNotReady', state })
      expect(app.deps.jobs.enqueued).toEqual([])
      expect((await analysisOf(projectId)).status).toBe('not_started')
    })
  })

  describe('running an analysis', () => {
    it('analyses the folder and stores the product brief', async () => {
      const projectId = await addApp()
      await app.requestAnalysis.execute({ projectId })

      expect(await app.runAnalysis.execute({ projectId })).toEqual({ status: 'succeeded' })

      expect(app.deps.analyzer.requests[0]?.folder.path).toBe('/home/ada/app')
      const analysis = await analysisOf(projectId)
      expect(analysis.status === 'succeeded' && analysis.brief.props.productName).toBe('Wiki Géo')
    })

    it('records the failure on the project', async () => {
      const projectId = await addApp()
      await app.requestAnalysis.execute({ projectId })
      app.deps.analyzer.failNextWith('Limite atteinte')

      expect(await app.runAnalysis.execute({ projectId })).toEqual({ status: 'failed', reason: 'Limite atteinte' })
      expect(await analysisOf(projectId)).toMatchObject({ status: 'failed', reason: 'Limite atteinte' })
    })

    it('skips a project whose analysis was not requested', async () => {
      const projectId = await addApp()

      expect((await app.runAnalysis.execute({ projectId })).status).toBe('skipped')
      expect(app.deps.analyzer.requests).toEqual([])
    })

    it('forwards what Claude is doing to the project', async () => {
      const projectId = await addApp()
      await app.requestAnalysis.execute({ projectId })
      app.deps.analyzer.activity = ['Lecture de README.md', 'Recherche des couleurs']
      const seen: (string | null)[] = []
      const save = app.deps.projects.save.bind(app.deps.projects)
      app.deps.projects.save = async (project) => {
        if (project.analysis.status === 'running') seen.push(project.analysis.activity)
        return save(project)
      }

      await app.runAnalysis.execute({ projectId })

      expect(seen).toContain('Recherche des couleurs')
    })
  })

  describe('personas', () => {
    const analysed = async () => {
      const projectId = await addApp()
      await app.requestAnalysis.execute({ projectId })
      await app.runAnalysis.execute({ projectId })
      return projectId
    }

    const personasOf = async (projectId: ProjectId) => {
      const project = await app.getProject.execute({ projectId })
      if (!project.ok) throw new Error(project.error.message)
      return project.value.personas
    }

    it('need a brief first', async () => {
      const projectId = await addApp()
      const requested = await app.requestPersonas.execute({ projectId })

      expect(requested.ok ? null : requested.error.type).toBe('BriefRequired')
      expect(app.deps.jobs.enqueued).toEqual([])
    })

    it('are queued, then written from the brief', async () => {
      const projectId = await analysed()

      const requested = await app.requestPersonas.execute({ projectId })
      expect(requested.ok && requested.value.personas.status).toBe('queued')
      expect(app.deps.jobs.enqueued.at(-1)).toEqual({ kind: 'personas', projectId })

      expect(await app.writePersonas.execute({ projectId })).toEqual({ status: 'succeeded' })

      expect(app.deps.personaWriter.requests[0]?.brief.props.productName).toBe('Wiki Géo')
      const personas = await personasOf(projectId)
      expect(personas.status === 'succeeded' && personas.personas.all.map((persona) => persona.name)).toEqual(['Léa', 'Marc'])
    })

    it('record a failure, and can be asked again', async () => {
      const projectId = await analysed()
      await app.requestPersonas.execute({ projectId })
      app.deps.personaWriter.failNextWith('Limite atteinte')

      expect(await app.writePersonas.execute({ projectId })).toEqual({ status: 'failed', reason: 'Limite atteinte' })
      expect(await personasOf(projectId)).toMatchObject({ status: 'failed', reason: 'Limite atteinte' })
      expect((await app.requestPersonas.execute({ projectId })).ok).toBe(true)
    })

    it('cannot be requested twice at once, nor while the code is analysed', async () => {
      const projectId = await analysed()
      await app.requestPersonas.execute({ projectId })

      const again = await app.requestPersonas.execute({ projectId })
      const reanalysis = await app.requestAnalysis.execute({ projectId })

      expect(again.ok ? null : again.error.type).toBe('InvalidPersonasTransition')
      expect(reanalysis.ok ? null : reanalysis.error.type).toBe('InvalidAnalysisTransition')
    })

    it('are discarded when a new analysis produces a new brief', async () => {
      const projectId = await analysed()
      await app.requestPersonas.execute({ projectId })
      await app.writePersonas.execute({ projectId })

      await app.requestAnalysis.execute({ projectId })
      await app.runAnalysis.execute({ projectId })

      expect((await personasOf(projectId)).status).toBe('not_started')
    })

    it('interrupted by a shutdown are marked as failed', async () => {
      const projectId = await analysed()
      await app.requestPersonas.execute({ projectId })

      expect(await app.recover.execute()).toEqual({ recovered: 1 })
      expect((await personasOf(projectId)).status).toBe('failed')
      expect((await analysisOf(projectId)).status).toBe('succeeded')
    })
  })

  describe('videos', () => {
    const quick = { production: 'template', demo: { mode: 'none', addresses: [] as string[] }, track: null }

    /** A project with its personas. Its videos are assembled from ready-made shots, unless `production` says otherwise. */
    const withPersonas = async (production = 'template') => {
      const projectId = await addApp()
      await app.requestAnalysis.execute({ projectId })
      await app.runAnalysis.execute({ projectId })
      await app.requestPersonas.execute({ projectId })
      await app.writePersonas.execute({ projectId })
      await app.setUpVideos.execute({ projectId, setup: { ...quick, production } })
      return projectId
    }

    const videoOf = async (projectId: ProjectId, persona: string) => {
      const project = await app.getProject.execute({ projectId })
      if (!project.ok) throw new Error(project.error.message)
      return project.value.videos.find((video) => video.persona === persona)?.state ?? null
    }

    /** Both rounds: the scripts are written, the recommended one is chosen, then the video is made from it. */
    const make = async (projectId: ProjectId, persona: string) => {
      const first = await app.produceVideo.execute({ projectId, persona })
      if (first.status !== 'scripted') return first
      const chosen = await app.chooseScript.execute({ projectId, persona, index: 1, texts: null })
      if (!chosen.ok) throw new Error(chosen.error.message)
      return app.produceVideo.execute({ projectId, persona })
    }

    const scriptsOf = async (projectId: ProjectId, persona: string) => {
      const project = await app.getProject.execute({ projectId })
      if (!project.ok) throw new Error(project.error.message)
      return project.value.videos.find((video) => video.persona === persona)?.scripts ?? null
    }

    describe('scripts', () => {
      it('are written and tested first, then the video waits for the user to pick one', async () => {
        const projectId = await withPersonas()
        await app.requestVideo.execute({ projectId, persona: 'Léa' })

        expect(await app.produceVideo.execute({ projectId, persona: 'Léa' })).toEqual({ status: 'scripted' })

        expect(app.deps.scriptWriter.requests[0]).toMatchObject({ persona: { name: 'Léa' }, direction: { props: { tone: 'dare' } } })
        expect(app.deps.storyboardWriter.requests).toEqual([])
        expect(app.deps.videoRenderer.requests).toEqual([])
        expect(await videoOf(projectId, 'Léa')).toMatchObject({ status: 'scripted' })
        const scripts = await scriptsOf(projectId, 'Léa')
        expect(scripts?.props).toMatchObject({ recommended: 1, chosen: null })
        expect(scripts?.props.candidates.map((script) => script.verdict)).toEqual(['fail', 'pass'])
      })

      it('do not block a new analysis or new personas while they wait for a choice', async () => {
        const projectId = await withPersonas()
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await app.produceVideo.execute({ projectId, persona: 'Léa' })

        expect((await app.requestPersonas.execute({ projectId })).ok).toBe(true)
      })

      it('make the video from the script the user picked', async () => {
        const projectId = await withPersonas()
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await app.produceVideo.execute({ projectId, persona: 'Léa' })

        const chosen = await app.chooseScript.execute({ projectId, persona: 'Léa', index: 0, texts: null })
        expect(chosen.ok).toBe(true)
        expect(await videoOf(projectId, 'Léa')).toMatchObject({ status: 'queued' })
        expect(app.deps.jobs.enqueued.at(-1)).toEqual({ kind: 'video', projectId, persona: 'Léa' })

        expect(await app.produceVideo.execute({ projectId, persona: 'Léa' })).toEqual({ status: 'succeeded' })
        expect(app.deps.scriptWriter.requests).toHaveLength(1)
        expect(app.deps.storyboardWriter.requests[0]?.script.props.format).toBe('problem-solution')
        expect((await scriptsOf(projectId, 'Léa'))?.props.chosen?.index).toBe(0)
      })

      it('carry the user’s own words, given long enough on screen to be read', async () => {
        const projectId = await withPersonas()
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await app.produceVideo.execute({ projectId, persona: 'Léa' })
        const texts = (await scriptsOf(projectId, 'Léa'))?.props.candidates[1]?.props.beats.map((beat) => beat.onScreen) ?? []
        texts[2] = 'Le même défi pour toute ta classe, chaque matin, avant le premier cours.'

        await app.chooseScript.execute({ projectId, persona: 'Léa', index: 1, texts })
        await app.produceVideo.execute({ projectId, persona: 'Léa' })

        const script = app.deps.storyboardWriter.requests[0]?.script
        expect(script?.props.edited).toBe(true)
        expect(script?.props.beats[2]).toMatchObject({ onScreen: texts[2], seconds: 3.8 })
      })

      it('refuse words that break the rules of the format', async () => {
        const projectId = await withPersonas()
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await app.produceVideo.execute({ projectId, persona: 'Léa' })
        const texts = (await scriptsOf(projectId, 'Léa'))?.props.candidates[1]?.props.beats.map((beat) => beat.onScreen) ?? []
        texts[0] = 'Découvre Wiki Géo'

        const refused = await app.chooseScript.execute({ projectId, persona: 'Léa', index: 1, texts })

        expect(refused.ok ? null : refused.error).toMatchObject({ type: 'InvalidScript', violations: ["L'accroche ne doit pas contenir le nom du produit."] })
        expect(await videoOf(projectId, 'Léa')).toMatchObject({ status: 'scripted' })
      })

      it('cannot be picked before they are written, nor while the video is being made', async () => {
        const projectId = await withPersonas()
        const none = await app.chooseScript.execute({ projectId, persona: 'Léa', index: 0, texts: null })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        const queued = await app.chooseScript.execute({ projectId, persona: 'Léa', index: 0, texts: null })

        expect(none.ok ? null : none.error.type).toBe('InvalidVideoTransition')
        expect(queued.ok ? null : queued.error.type).toBe('InvalidVideoTransition')
      })

      it('stay with the video, so another one can be made without writing them again', async () => {
        const projectId = await withPersonas()
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await make(projectId, 'Léa')

        await app.chooseScript.execute({ projectId, persona: 'Léa', index: 0, texts: null })
        expect(await app.produceVideo.execute({ projectId, persona: 'Léa' })).toEqual({ status: 'succeeded' })

        expect(app.deps.scriptWriter.requests).toHaveLength(1)
        expect(app.deps.storyboardWriter.requests.map((request) => request.script.props.format)).toEqual(['play-along', 'problem-solution'])
      })

      it('stay after a failure of the video, and after a shutdown, so it can be tried again', async () => {
        const projectId = await withPersonas()
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await app.produceVideo.execute({ projectId, persona: 'Léa' })
        await app.chooseScript.execute({ projectId, persona: 'Léa', index: 1, texts: null })
        await app.recover.execute()

        expect((await videoOf(projectId, 'Léa'))?.status).toBe('failed')
        expect((await app.chooseScript.execute({ projectId, persona: 'Léa', index: 1, texts: null })).ok).toBe(true)
      })

      it('are written anew when the video is asked for again', async () => {
        const projectId = await withPersonas()
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await make(projectId, 'Léa')

        await app.requestVideo.execute({ projectId, persona: 'Léa' })

        expect(await scriptsOf(projectId, 'Léa')).toBeNull()
      })

      it('record a failure of the writing', async () => {
        const projectId = await withPersonas()
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        app.deps.scriptWriter.failNextWith('Limite atteinte')

        expect(await app.produceVideo.execute({ projectId, persona: 'Léa' })).toEqual({ status: 'failed', reason: 'Limite atteinte' })
        expect(await scriptsOf(projectId, 'Léa')).toBeNull()
      })
    })

    it('need the persona to exist', async () => {
      const projectId = await withPersonas()
      const requested = await app.requestVideo.execute({ projectId, persona: 'Inconnu' })

      expect(requested.ok ? null : requested.error.type).toBe('PersonaNotFound')
      expect(app.deps.jobs.enqueued.some((job) => job.kind === 'video')).toBe(false)
    })

    it('are queued for one persona, written by Claude, then rendered', async () => {
      const projectId = await withPersonas()

      const requested = await app.requestVideo.execute({ projectId, persona: 'Léa' })
      expect(requested.ok).toBe(true)
      expect(await videoOf(projectId, 'Léa')).toMatchObject({ status: 'queued' })
      expect(app.deps.jobs.enqueued.at(-1)).toEqual({ kind: 'video', projectId, persona: 'Léa' })

      expect(await make(projectId, 'Léa')).toEqual({ status: 'succeeded' })

      expect(app.deps.storyboardWriter.requests[0]?.persona.name).toBe('Léa')
      expect(app.deps.videoRenderer.requests[0]).toMatchObject({ persona: 'Léa', source: { kind: 'storyboard' } })
      const video = await videoOf(projectId, 'Léa')
      expect(video).toMatchObject({ status: 'succeeded', file: `/videos/${projectId}/Léa.mp4` })
      expect(video?.status === 'succeeded' && video.seconds).toBeGreaterThan(12)

      const file = await app.getVideoFile.execute({ projectId, persona: 'Léa' })
      expect(file.ok && file.value).toEqual({ file: `/videos/${projectId}/Léa.mp4`, product: 'Wiki Géo' })
    })

    it('can be produced for two personas at once without losing either', async () => {
      const projectId = await withPersonas()
      await app.requestVideo.execute({ projectId, persona: 'Léa' })
      await app.requestVideo.execute({ projectId, persona: 'Marc' })

      await Promise.all([
        make(projectId, 'Léa'),
        make(projectId, 'Marc'),
      ])

      expect((await videoOf(projectId, 'Léa'))?.status).toBe('succeeded')
      expect((await videoOf(projectId, 'Marc'))?.status).toBe('succeeded')
    })

    it('show how far the render is', async () => {
      const projectId = await withPersonas()
      await app.requestVideo.execute({ projectId, persona: 'Léa' })
      app.deps.videoRenderer.progress = [0.1, 0.11, 0.5, 1]
      const seen: (number | null)[] = []
      const update = app.deps.projects.update.bind(app.deps.projects)
      app.deps.projects.update = async (id, change) =>
        update(id, (project) => {
          const result = change(project)
          const state = project.videos.find((video) => video.persona === 'Léa')?.state
          if (state?.status === 'running' && state.step === 'render') seen.push(state.progress)
          return result
        })

      await make(projectId, 'Léa')

      // 0.11 is too close to 0.1 to be worth saving.
      expect(seen).toEqual([null, 0.1, 0.5, 1])
    })

    it.each([
      ['the storyboard', () => app.deps.storyboardWriter.failNextWith('Limite atteinte')],
      ['the render', () => app.deps.videoRenderer.failNextWith('Limite atteinte')],
    ])('record a failure of %s, and can be asked again', async (_, breakIt) => {
      const projectId = await withPersonas()
      await app.requestVideo.execute({ projectId, persona: 'Léa' })
      breakIt()

      expect(await make(projectId, 'Léa')).toEqual({ status: 'failed', reason: 'Limite atteinte' })
      expect(await videoOf(projectId, 'Léa')).toMatchObject({ status: 'failed', reason: 'Limite atteinte' })
      expect((await app.requestVideo.execute({ projectId, persona: 'Léa' })).ok).toBe(true)
    })

    it('cannot be requested twice at once, and block a new analysis or new personas', async () => {
      const projectId = await withPersonas()
      await app.requestVideo.execute({ projectId, persona: 'Léa' })

      const again = await app.requestVideo.execute({ projectId, persona: 'Léa' })
      const reanalysis = await app.requestAnalysis.execute({ projectId })
      const rewrite = await app.requestPersonas.execute({ projectId })
      const removed = await app.removeProject.execute({ projectId })

      expect(again.ok ? null : again.error.type).toBe('InvalidVideoTransition')
      expect(reanalysis.ok ? null : reanalysis.error.type).toBe('InvalidAnalysisTransition')
      expect(rewrite.ok ? null : rewrite.error.type).toBe('InvalidPersonasTransition')
      expect(removed.ok ? null : removed.error.type).toBe('WorkInProgress')
    })

    it('are skipped when nothing was requested', async () => {
      const projectId = await withPersonas()

      expect((await make(projectId, 'Léa')).status).toBe('skipped')
      expect(app.deps.storyboardWriter.requests).toEqual([])
    })

    it('are discarded when the personas are rewritten', async () => {
      const projectId = await withPersonas()
      await app.requestVideo.execute({ projectId, persona: 'Léa' })
      await make(projectId, 'Léa')

      await app.requestPersonas.execute({ projectId })
      await app.writePersonas.execute({ projectId })

      expect(await videoOf(projectId, 'Léa')).toBeNull()
      const file = await app.getVideoFile.execute({ projectId, persona: 'Léa' })
      expect(file.ok ? null : file.error.type).toBe('VideoNotFound')
    })

    it('interrupted by a shutdown are marked as failed', async () => {
      const projectId = await withPersonas()
      await app.requestVideo.execute({ projectId, persona: 'Léa' })

      expect(await app.recover.execute()).toEqual({ recovered: 1 })
      expect((await videoOf(projectId, 'Léa'))?.status).toBe('failed')
    })

    describe('directed by Claude', () => {
      it('are what a project makes unless told otherwise', async () => {
        const project = await app.getProject.execute({ projectId: await addApp() })
        expect(project.ok && project.value.videoSetup.props.production).toBe('directed')
      })

      it('are directed from scratch, then rendered from the workspace Claude worked in', async () => {
        const projectId = await withPersonas('directed')
        await app.requestVideo.execute({ projectId, persona: 'Léa' })

        expect(await make(projectId, 'Léa')).toEqual({ status: 'succeeded' })

        expect(app.deps.storyboardWriter.requests).toEqual([])
        expect(app.deps.videoDirector.requests[0]).toMatchObject({ projectId, persona: { name: 'Léa' }, direction: { props: { look: 'neon', tone: 'dare' } } })
        expect(app.deps.videoRenderer.requests[0]).toMatchObject({ persona: 'Léa', source: { kind: 'piece', workspace: `/studio/${projectId}/Léa` } })
        const video = await videoOf(projectId, 'Léa')
        expect(video?.status === 'succeeded' && video.work.kind === 'piece' && video.work.piece.props.shots).toHaveLength(4)
      })

      it('show what Claude is doing while it directs', async () => {
        const projectId = await withPersonas('directed')
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        app.deps.videoDirector.activity = ['Écrit src/Video.tsx', 'Écrit src/Video.tsx', 'Regarde ses images']
        const seen: (string | null)[] = []
        const update = app.deps.projects.update.bind(app.deps.projects)
        app.deps.projects.update = async (id, change) =>
          update(id, (project) => {
            const result = change(project)
            const state = project.videos.find((video) => video.persona === 'Léa')?.state
            if (state?.status === 'running' && state.step === 'direct' && state.activity !== seen.at(-1)) seen.push(state.activity)
            return result
          })

        await make(projectId, 'Léa')

        expect(seen).toEqual([null, 'Écrit src/Video.tsx', 'Regarde ses images'])
      })

      it('film the application first when they show it, and hand the pictures to the director', async () => {
        const projectId = await withPersonas('directed')
        await app.setUpVideos.execute({ projectId, setup: { ...quick, production: 'directed', demo: { mode: 'pages', addresses: ['http://localhost:5173'] } } })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })

        await make(projectId, 'Léa')

        expect(app.deps.videoDirector.requests[0]?.screens.map((screen) => screen.address)).toEqual(['http://localhost:5173'])
        expect(app.deps.videoRenderer.requests[0]?.screens).toHaveLength(1)
      })

      it('record a failure of the direction, without rendering anything', async () => {
        const projectId = await withPersonas('directed')
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        app.deps.videoDirector.failNextWith('Claude a dépassé 45 minutes et a été arrêté.')

        expect(await make(projectId, 'Léa')).toEqual({ status: 'failed', reason: 'Claude a dépassé 45 minutes et a été arrêté.' })
        expect(app.deps.videoRenderer.requests).toEqual([])
      })
    })

    describe('directed', () => {
      const noDemo = { mode: 'none', addresses: [] as string[] }
      const setup = (demo: { mode: string; addresses: string[] }, track: string | null = null) => ({ production: 'template', demo, track })
      const directed = (projectId: ProjectId, demo: { mode: string; addresses: string[] }) =>
        app.setUpVideos.execute({ projectId, setup: setup(demo) })

      it('get, for each persona, the style Claude proposed when the personas were written', async () => {
        const projectId = await withPersonas()
        const project = await app.getProject.execute({ projectId })

        expect(project.ok && project.value.styles).toEqual([
          { persona: 'Léa', choice: null, suggestion: { look: 'neon', tone: 'dare', sound: 'beat', reason: 'Joue le soir, aime la compétition.' } },
          { persona: 'Marc', choice: null, suggestion: { look: 'pop', tone: 'genz', sound: 'effects', reason: 'Jeune, sur TikTok.' } },
        ])

        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await app.requestVideo.execute({ projectId, persona: 'Marc' })
        await make(projectId, 'Léa')
        await make(projectId, 'Marc')

        expect(app.deps.videoRenderer.requests.map((request) => request.direction.props.look)).toEqual(['neon', 'pop'])
        expect(app.deps.storyboardWriter.requests.map((request) => request.direction.props.tone)).toEqual(['dare', 'genz'])
      })

      it('are made in the brand’s look and voice, silent, when Claude could not propose a style', async () => {
        const projectId = await addApp()
        await app.requestAnalysis.execute({ projectId })
        await app.runAnalysis.execute({ projectId })
        await app.requestPersonas.execute({ projectId })
        app.deps.styleAdvisor.failNextWith('Limite atteinte')

        // The personas are still written: a missing proposal costs nothing.
        expect(await app.writePersonas.execute({ projectId })).toEqual({ status: 'succeeded' })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await make(projectId, 'Léa')

        expect(app.deps.videoRenderer.requests[0]?.direction.props).toEqual({ look: 'brand', tone: 'brand', sound: 'none', track: null, demo: noDemo, production: 'directed' })
        expect(app.deps.appCapturer.requests).toEqual([])
      })

      it('follow the user’s own choice for a persona, until they go back to the proposal', async () => {
        const projectId = await withPersonas()
        const chosen = await app.chooseStyle.execute({ projectId, persona: 'Léa', style: { look: 'editorial', tone: 'premium', sound: 'none' } })
        expect(chosen.ok && chosen.value.styles[0]?.choice).toEqual({ look: 'editorial', tone: 'premium', sound: 'none' })

        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        // Changing one's mind afterwards only applies to the next videos.
        await app.chooseStyle.execute({ projectId, persona: 'Léa', style: null })
        await make(projectId, 'Léa')

        expect(app.deps.videoRenderer.requests[0]?.direction.props).toMatchObject({ look: 'editorial', tone: 'premium', sound: 'none' })
        const video = await videoOf(projectId, 'Léa')
        expect(video?.status === 'succeeded' && video.direction.props.look).toBe('editorial')

        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await make(projectId, 'Léa')
        expect(app.deps.videoRenderer.requests[1]?.direction.props.look).toBe('neon')
      })

      it('can all take the same style at once', async () => {
        const projectId = await withPersonas()
        const all = await app.chooseStyle.execute({ projectId, persona: null, style: { look: 'cinema', tone: 'trailer', sound: 'beat' } })

        expect(all.ok && all.value.styles.map((style) => style.choice?.look)).toEqual(['cinema', 'cinema'])
      })

      it('refuse a style that does not exist, or for a persona that does not', async () => {
        const projectId = await withPersonas()
        const unknownLook = await app.chooseStyle.execute({ projectId, persona: 'Léa', style: { look: 'vaporwave', tone: 'brand', sound: 'none' } })
        const unknownPersona = await app.chooseStyle.execute({ projectId, persona: 'Inconnu', style: { look: 'neon', tone: 'brand', sound: 'none' } })

        expect(unknownLook.ok ? null : unknownLook.error).toMatchObject({ type: 'InvalidVideoStyle', violations: ["« vaporwave » n'est pas une direction artistique connue."] })
        expect(unknownPersona.ok ? null : unknownPersona.error.type).toBe('PersonaNotFound')
      })

      it('can be proposed again, without touching what the user chose', async () => {
        const projectId = await withPersonas()
        await app.chooseStyle.execute({ projectId, persona: 'Léa', style: { look: 'retro', tone: 'funny', sound: 'none' } })

        const again = await app.suggestStyles.execute({ projectId })

        expect(again.ok && again.value.styles[0]).toMatchObject({ choice: { look: 'retro' }, suggestion: { look: 'neon' } })
        expect(app.deps.styleAdvisor.requests).toHaveLength(2)
      })

      it('cannot be proposed before the personas exist, or without Claude Code', async () => {
        const noPersonas = await app.suggestStyles.execute({ projectId: await addApp() })
        expect(noPersonas.ok ? null : noPersonas.error.type).toBe('PersonasRequired')
      })

      it('lose their styles with the personas they were for', async () => {
        const projectId = await withPersonas()
        await app.chooseStyle.execute({ projectId, persona: 'Léa', style: { look: 'retro', tone: 'funny', sound: 'none' } })
        app.deps.styleAdvisor.failNextWith('Limite atteinte')

        await app.requestPersonas.execute({ projectId })
        await app.writePersonas.execute({ projectId })

        const project = await app.getProject.execute({ projectId })
        expect(project.ok && project.value.styles).toEqual([])
      })

      it('film the pages the user listed, and tell the writer what was filmed', async () => {
        const projectId = await withPersonas()
        const pages = ['http://localhost:5173', 'http://localhost:5173/defi']
        await directed(projectId, { mode: 'pages', addresses: pages })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })

        expect(await make(projectId, 'Léa')).toEqual({ status: 'succeeded' })

        expect(app.deps.demoScout.requests).toEqual([])
        expect(app.deps.appCapturer.requests).toEqual([{ projectId, persona: 'Léa', take: 'pages', addresses: pages, lenient: false, language: null }])
        expect(app.deps.storyboardWriter.requests[0]?.screens.map((screen) => screen.title)).toEqual(['Page 1', 'Page 2'])
        expect(app.deps.videoRenderer.requests[0]?.screens).toHaveLength(2)
        const source = app.deps.videoRenderer.requests[0]?.source
        expect(source?.kind === 'storyboard' && source.storyboard.props.scenes.map((scene) => scene.kind)).toContain('demo')
      })

      it('let Claude pick the pages from the code, for that persona, when asked to', async () => {
        const projectId = await withPersonas()
        await directed(projectId, { mode: 'auto', addresses: ['http://localhost:5173'] })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        expect(await videoOf(projectId, 'Léa')).toMatchObject({ status: 'queued' })

        await make(projectId, 'Léa')

        expect(app.deps.demoScout.requests[0]?.persona.name).toBe('Léa')
        expect(app.deps.appCapturer.requests).toMatchObject([
          { take: 'home', addresses: ['http://localhost:5173'], lenient: false },
          // Filmed in the language the video is written in.
          { take: 'pages', addresses: ['http://localhost:5173/', 'http://localhost:5173/classement'], lenient: true, language: 'fr' },
        ])
        // The writer knows what each page shows: Claude read it in the code.
        expect(app.deps.storyboardWriter.requests[0]?.screens.map((screen) => screen.shows)).toEqual(["L'accueil et le défi du jour", 'Le classement des joueurs'])
      })

      it('never film anything outside the application, whatever Claude proposes', async () => {
        const projectId = await withPersonas()
        await directed(projectId, { mode: 'auto', addresses: ['http://localhost:5173'] })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        app.deps.demoScout.pages = [
          { path: 'https://elsewhere.test/login', shows: 'Un autre site' },
          { path: '//elsewhere.test', shows: 'Un autre site' },
          { path: '/defi', shows: 'Le défi du jour' },
        ]

        await make(projectId, 'Léa')

        expect(app.deps.appCapturer.requests[1]?.addresses).toEqual(['http://localhost:5173/defi'])
      })

      it('film the home page when none of the pages Claude picked opens', async () => {
        const projectId = await withPersonas()
        await directed(projectId, { mode: 'auto', addresses: ['http://localhost:5173'] })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        app.deps.appCapturer.missing = ['http://localhost:5173/', 'http://localhost:5173/classement']

        expect(await make(projectId, 'Léa')).toEqual({ status: 'succeeded' })
        expect(app.deps.videoRenderer.requests[0]?.screens.map((screen) => screen.address)).toEqual(['http://localhost:5173'])
      })

      it('fail before anything is written when the application cannot be filmed', async () => {
        const projectId = await withPersonas()
        await directed(projectId, { mode: 'pages', addresses: ['http://localhost:5173'] })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        app.deps.appCapturer.failNextWith("L'application ne répond pas.")

        expect(await make(projectId, 'Léa')).toEqual({ status: 'failed', reason: "L'application ne répond pas." })
        expect(app.deps.storyboardWriter.requests).toEqual([])
      })

      it('do not ask Claude anything when the application to film is not running', async () => {
        const projectId = await withPersonas()
        await directed(projectId, { mode: 'auto', addresses: ['http://localhost:5173'] })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        app.deps.appCapturer.failNextWith("L'application ne répond pas.")

        expect(await make(projectId, 'Léa')).toEqual({ status: 'failed', reason: "L'application ne répond pas." })
        expect(app.deps.demoScout.requests).toEqual([])
        expect(app.deps.storyboardWriter.requests).toEqual([])
      })

      it('fail when Claude could not read the code to pick pages', async () => {
        const projectId = await withPersonas()
        await directed(projectId, { mode: 'auto', addresses: ['http://localhost:5173'] })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        app.deps.demoScout.failNextWith('Limite atteinte')

        expect(await make(projectId, 'Léa')).toEqual({ status: 'failed', reason: 'Limite atteinte' })
        expect(app.deps.storyboardWriter.requests).toEqual([])
      })

      it('play the user’s own music for the personas who ask for it, once the file is found', async () => {
        const projectId = await withPersonas()

        const found = await app.setUpVideos.execute({ projectId, setup: setup(noDemo, '~/Music/beat.mp3') })
        const missing = await app.setUpVideos.execute({ projectId, setup: setup(noDemo, '~/Music/nope.mp3') })
        expect(found.ok && found.value.videoSetup.props.track).toBe('/home/ada/Music/beat.mp3')
        expect(missing.ok ? null : missing.error.type).toBe('TrackNotFound')

        await app.chooseStyle.execute({ projectId, persona: 'Léa', style: { look: 'brand', tone: 'brand', sound: 'track' } })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })
        await app.requestVideo.execute({ projectId, persona: 'Marc' })

        expect(await videoOf(projectId, 'Léa')).toMatchObject({ direction: { props: { sound: 'track', track: '/home/ada/Music/beat.mp3' } } })
        expect(await videoOf(projectId, 'Marc')).toMatchObject({ direction: { props: { sound: 'effects', track: null } } })
      })

      it('fall back to sound effects when their own music was asked for but no file was given', async () => {
        const projectId = await withPersonas()
        await app.chooseStyle.execute({ projectId, persona: 'Léa', style: { look: 'brand', tone: 'brand', sound: 'track' } })
        await app.requestVideo.execute({ projectId, persona: 'Léa' })

        expect(await videoOf(projectId, 'Léa')).toMatchObject({ direction: { props: { sound: 'effects', track: null } } })
      })

      it('refuse a setup that makes no sense', async () => {
        const projectId = await withPersonas()
        const refused = await directed(projectId, { mode: 'auto', addresses: [] })

        expect(refused.ok ? null : refused.error).toMatchObject({ type: 'InvalidVideoSetup', violations: ["Indiquez l'adresse où tourne votre application (une seule)."] })
      })
    })

    it('are deleted with the project', async () => {
      const projectId = await withPersonas()

      await app.removeProject.execute({ projectId })

      expect(app.deps.videoRenderer.discarded).toEqual([projectId])
      expect(app.deps.appCapturer.discarded).toEqual([projectId])
      expect(app.deps.videoDirector.discarded).toEqual([projectId])
    })
  })

  it('marks analyses interrupted by a shutdown as failed, so they can be relaunched', async () => {
    const projectId = await addApp()
    const idle = await app.addProject.execute({ folder: '/home/ada/other' })
    await app.requestAnalysis.execute({ projectId })

    expect(await app.recover.execute()).toEqual({ recovered: 1 })
    expect((await analysisOf(projectId)).status).toBe('failed')
    expect(idle.ok && (await analysisOf(idle.value.id)).status).toBe('not_started')
    expect((await app.requestAnalysis.execute({ projectId })).ok).toBe(true)
  })

  describe('removing a project', () => {
    it('forgets it', async () => {
      const projectId = await addApp()

      expect((await app.removeProject.execute({ projectId })).ok).toBe(true)
      expect(await app.listProjects.execute()).toEqual([])
    })

    it('waits for a running analysis', async () => {
      const projectId = await addApp()
      await app.requestAnalysis.execute({ projectId })

      const removed = await app.removeProject.execute({ projectId })
      expect(removed.ok ? null : removed.error.type).toBe('WorkInProgress')
    })
  })
})
