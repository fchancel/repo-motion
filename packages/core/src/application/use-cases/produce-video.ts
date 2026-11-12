import type { ProductBrief } from '../../domain/analysis/product-brief'
import type { Persona } from '../../domain/persona/persona'
import type { ProjectId, VideoStep, VideoWork } from '../../domain/project/project'
import type { ProjectFolder } from '../../domain/project/project-folder'
import { demoPagesOn, type AppScreen, type VideoDirection } from '../../domain/video/direction'
import { ScriptSet, type Script } from '../../domain/video/script'
import type { Failure } from '../../shared/errors'
import { ok, type Result } from '../../shared/result'
import type { ProjectRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'
import type { AppCapturer, DemoScout, ScriptWriter, StoryboardWriter, VideoDirector, VideoRenderer, VideoRenderRequest } from '../ports/video'

export type ProduceVideoOutcome =
  | { readonly status: 'succeeded' }
  /** The scripts are written: the video waits for the user to pick one. */
  | { readonly status: 'scripted' }
  | { readonly status: 'failed'; readonly reason: string }
  /** Nothing to do: the project or the persona is gone, or that video is not waiting to be produced. */
  | { readonly status: 'skipped'; readonly reason: string }

type Start =
  | {
      readonly ready: true
      readonly brief: ProductBrief
      readonly persona: Persona
      readonly folder: ProjectFolder
      readonly direction: VideoDirection
      /** The script the user chose, and the pages filmed for it. Null: the scripts are still to write. */
      readonly chosen: { readonly script: Script; readonly screens: readonly AppScreen[] } | null
    }
  | { readonly ready: false; readonly reason: string }

/** Progress is saved each time it has moved by this much, not at every frame. */
const PROGRESS_STEP = 0.05

/**
 * Runs in the background, in two rounds. First the application is filmed if the video shows
 * it, and Claude writes and tests several scripts: the video then waits for the user to pick
 * one. Once they have, Claude directs the video from that script (or only fits it into a
 * storyboard, for the quick way), and it is rendered to an MP4.
 * Several videos of one project may be produced at once, so every change to the project goes
 * through `projects.update`. Expected failures end up recorded on the video; only bugs are thrown.
 */
export class ProduceVideo {
  constructor(
    private readonly deps: {
      readonly projects: ProjectRepository
      readonly demoScout: DemoScout
      readonly appCapturer: AppCapturer
      readonly scriptWriter: ScriptWriter
      readonly storyboardWriter: StoryboardWriter
      readonly videoDirector: VideoDirector
      readonly videoRenderer: VideoRenderer
      readonly clock: Clock
    },
  ) {}

  async execute(command: { readonly projectId: ProjectId; readonly persona: string }): Promise<ProduceVideoOutcome> {
    const { projects, scriptWriter, storyboardWriter, videoDirector, videoRenderer, clock } = this.deps
    const { projectId, persona: name } = command

    const started = await projects.update(projectId, (project): Start => {
      const brief = project.brief
      const persona = project.persona(name)
      if (!brief || !persona) return { ready: false, reason: 'Persona introuvable.' }
      const direction = project.videos.find((video) => video.persona === name)?.state
      const chosen = project.scriptsOf(name)?.props
      const result = project.startVideo(name, clock.now())
      return result.ok && direction?.status === 'queued'
        ? {
            ready: true,
            brief,
            persona,
            folder: project.folder,
            direction: direction.direction,
            chosen: chosen?.chosen ? { script: chosen.chosen.script, screens: chosen.screens } : null,
          }
        : { ready: false, reason: result.ok ? 'Vidéo introuvable.' : result.error.message }
    })
    if (!started) return { status: 'skipped', reason: 'Projet introuvable.' }
    if (!started.ready) return { status: 'skipped', reason: started.reason }

    const fail = async (reason: string): Promise<ProduceVideoOutcome> => {
      await projects.update(projectId, (project) => project.failVideo(name, reason, clock.now()))
      return { status: 'failed', reason }
    }

    const report = (step: VideoStep, progress: number | null = null) => {
      void projects.update(projectId, (project) => project.reportVideoProgress(name, step, progress))
    }

    const activity = (() => {
      let last = ''
      return (text: string) => {
        if (text === last) return
        last = text
        void projects.update(projectId, (project) => project.reportVideoActivity(name, text))
      }
    })()

    // First round: the scripts, among which the user will pick.
    if (!started.chosen) {
      // Filmed first: if the application is not running, there is no point in writing anything.
      let screens: AppScreen[] = []
      if (started.direction.showsDemo) {
        const filmed = await this.film(started, projectId, () => report('capture'))
        if (!filmed.ok) return fail(filmed.error.message)
        screens = filmed.value
      }
      report('script')
      const written = await scriptWriter.write({ ...started, screens, onActivity: activity })
      if (!written.ok) return fail(written.error.message)

      const scripts = ScriptSet.of({ ...written.value, direction: started.direction, screens, writtenAt: clock.now() })
      await projects.update(projectId, (project) => project.offerScripts(name, scripts, clock.now()))
      return { status: 'scripted' }
    }

    // Second round: the video, made from the script the user chose.
    const { script, screens } = started.chosen

    // What the video is made from: a piece Claude directs from scratch, or a storyboard for the ready-made shots.
    let work: VideoWork
    let source: VideoRenderRequest['source']
    if (started.direction.props.production === 'directed') {
      report('direct')
      const directed = await videoDirector.direct({ ...started, projectId, script, screens, onActivity: activity })
      if (!directed.ok) return fail(directed.error.message)
      work = { kind: 'piece', piece: directed.value.piece }
      source = { kind: 'piece', workspace: directed.value.workspace }
    } else {
      const storyboard = await storyboardWriter.write({ ...started, script, screens })
      if (!storyboard.ok) return fail(storyboard.error.message)
      work = { kind: 'storyboard', storyboard: storyboard.value }
      source = work
    }

    let saved = -1
    const reportProgress = (progress: number | null) => report('render', progress)
    reportProgress(null)

    const rendered = await videoRenderer.render({
      projectId,
      folder: started.folder,
      brief: started.brief,
      persona: name,
      source,
      direction: started.direction,
      screens,
      onProgress: (progress) => {
        if (progress - saved < PROGRESS_STEP) return
        saved = progress
        reportProgress(progress)
      },
    })
    if (!rendered.ok) return fail(rendered.error.message)

    await projects.update(projectId, (project) => project.completeVideo(name, { work, ...rendered.value }, clock.now()))
    return { status: 'succeeded' }
  }

  /** Photographs the application: the pages the user listed, or those Claude picks from the code. */
  private async film(
    started: Extract<Start, { ready: true }>,
    projectId: ProjectId,
    onScouted: () => void,
  ): Promise<Result<AppScreen[], Failure<string>>> {
    const { demoScout, appCapturer } = this.deps
    const { mode, addresses } = started.direction.props.demo

    const persona = started.persona.name
    const unseen = (screens: readonly Omit<AppScreen, 'shows'>[]) => screens.map((screen) => ({ ...screen, shows: null }))

    if (mode !== 'auto') {
      const captured = await appCapturer.capture({ projectId, persona, take: 'pages', addresses, lenient: false, language: null })
      return captured.ok ? ok(unseen(captured.value)) : captured
    }

    // The home page first: if the application is not running, Claude is not asked anything.
    const home = addresses[0] ?? ''
    const opened = await appCapturer.capture({ projectId, persona, take: 'home', addresses: [home], lenient: false, language: null })
    if (!opened.ok) return opened

    const scouted = await demoScout.scout(started)
    if (!scouted.ok) return scouted
    onScouted()

    // What each page shows, by the address it has in the running application.
    const { pages, language } = scouted.value
    const shows = new Map(pages.flatMap((page) => demoPagesOn(home, [page.path]).map((address) => [address, page.shows] as const)))
    const picked = demoPagesOn(home, pages.map((page) => page.path))

    // A page read in the code may not open for real: if none does, the home page already filmed is shown.
    const captured = picked.length > 0 ? await appCapturer.capture({ projectId, persona, take: 'pages', addresses: picked, lenient: true, language }) : null
    return ok(captured?.ok ? captured.value.map((screen) => ({ ...screen, shows: shows.get(screen.address) ?? null })) : unseen(opened.value))
  }
}
