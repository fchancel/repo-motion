import type { AnalysisState, PersonasState, ProjectId, ProjectSnapshot, Scene, Script, ScriptSet, VideoDirection, VideoState, VideoWork } from '@repo-motion/core'
import { DEFAULT_STYLE, sceneSeconds } from '@repo-motion/core'
import type { AnalysisDto, PersonaStyleDto, PersonasDto, ProjectDto, ScriptDto, ScriptSetDto, VideoDirectionDto, VideoDto, VideoOutlineDto } from '#shared/types/api'

const presentAnalysis = (analysis: AnalysisState): AnalysisDto => {
  switch (analysis.status) {
    case 'not_started':
      return analysis
    case 'queued':
      return { status: 'queued', requestedAt: analysis.requestedAt.toISOString() }
    case 'running':
      return {
        status: 'running',
        requestedAt: analysis.requestedAt.toISOString(),
        startedAt: analysis.startedAt.toISOString(),
        activity: analysis.activity,
      }
    case 'succeeded': {
      const { audiences, features, userJourneys, brand, evidence, ...text } = analysis.brief.props
      return {
        status: 'succeeded',
        completedAt: analysis.completedAt.toISOString(),
        brief: {
          ...text,
          audiences: [...audiences],
          features: [...features],
          userJourneys: userJourneys.map((journey) => ({ name: journey.name, steps: [...journey.steps] })),
          brand: { ...brand, colors: { ...brand.colors }, fonts: [...brand.fonts] },
          evidence: [...evidence],
        },
      }
    }
    case 'failed':
      return { status: 'failed', reason: analysis.reason, failedAt: analysis.failedAt.toISOString() }
  }
}

const presentPersonas = (state: PersonasState): PersonasDto => {
  switch (state.status) {
    case 'not_started':
      return state
    case 'queued':
      return { status: 'queued', requestedAt: state.requestedAt.toISOString() }
    case 'running':
      return { status: 'running', requestedAt: state.requestedAt.toISOString(), startedAt: state.startedAt.toISOString() }
    case 'succeeded':
      return {
        status: 'succeeded',
        completedAt: state.completedAt.toISOString(),
        personas: state.personas.all.map((persona) => ({
          ...persona,
          pains: [...persona.pains],
          objections: [...persona.objections],
          keyFeatures: [...persona.keyFeatures],
          vocabulary: [...persona.vocabulary],
          channels: [...persona.channels],
        })),
      }
    case 'failed':
      return { status: 'failed', reason: state.reason, failedAt: state.failedAt.toISOString() }
  }
}

const presentDirection = (direction: VideoDirection): VideoDirectionDto => ({
  ...direction.props,
  demo: { mode: direction.props.demo.mode, addresses: [...direction.props.demo.addresses] },
})

const SHOT_LABELS: Record<Scene['kind'], string> = {
  hook: 'Accroche',
  pain: 'Douleur',
  reveal: 'Révélation',
  demo: 'Démo',
  feature: 'Fonctionnalité',
  benefit: 'Bénéfice',
  cta: 'Appel à l’action',
}

/** The texts of a ready-made shot, in the order they appear on screen. */
const shotTexts = (scene: Scene): string[] => {
  switch (scene.kind) {
    case 'hook':
    case 'benefit':
    case 'cta':
      return [scene.text]
    case 'pain':
      return [...scene.lines]
    case 'reveal':
      return [scene.line]
    case 'demo':
      return [scene.caption]
    case 'feature':
      return [scene.title, scene.caption]
  }
}

/** A video shot by shot, the same way whether Claude directed it or only wrote its storyboard. */
const presentOutline = (work: VideoWork): VideoOutlineDto => {
  if (work.kind === 'piece') {
    const { concept, shots, post } = work.piece.props
    return {
      concept,
      shots: shots.map((shot) => ({ label: shot.label, texts: shot.text ? [shot.text] : [], seconds: shot.seconds })),
      post: { caption: post.caption, hashtags: [...post.hashtags] },
    }
  }
  const { scenes, post } = work.storyboard.props
  return {
    concept: null,
    shots: scenes.map((scene) => ({ label: SHOT_LABELS[scene.kind], texts: shotTexts(scene), seconds: sceneSeconds(scene) })),
    post: { caption: post.caption, hashtags: [...post.hashtags] },
  }
}

const presentVideo = (projectId: ProjectId, persona: string, state: VideoState): VideoDto => {
  switch (state.status) {
    case 'queued':
      return { status: 'queued', requestedAt: state.requestedAt.toISOString(), direction: presentDirection(state.direction) }
    case 'running':
      return {
        status: 'running',
        requestedAt: state.requestedAt.toISOString(),
        startedAt: state.startedAt.toISOString(),
        step: state.step,
        progress: state.progress,
        activity: state.activity,
        direction: presentDirection(state.direction),
      }
    case 'succeeded': {
      // The date makes a new address for each new version: the browser never plays a stale file.
      const address = new URLSearchParams({ persona, v: String(state.completedAt.getTime()) })
      return {
        status: 'succeeded',
        completedAt: state.completedAt.toISOString(),
        seconds: state.seconds,
        direction: presentDirection(state.direction),
        url: `/api/projects/${projectId}/videos/file?${address}`,
        outline: presentOutline(state.work),
      }
    }
    case 'scripted':
      return {
        status: 'scripted',
        requestedAt: state.requestedAt.toISOString(),
        scriptedAt: state.scriptedAt.toISOString(),
        direction: presentDirection(state.direction),
      }
    case 'failed':
      return { status: 'failed', reason: state.reason, failedAt: state.failedAt.toISOString() }
  }
}

const presentScript = (script: Script): ScriptDto => {
  const { format, angle, openLoop, beats, post, test, edited } = script.props
  const starts = script.starts
  return {
    format,
    angle,
    openLoop,
    beats: beats.map((beat, index) => ({ ...beat, start: starts[index] ?? 0 })),
    seconds: script.seconds,
    post: { caption: post.caption, hashtags: [...post.hashtags] },
    test: test ? { ...test, confusing: [...test.confusing], scores: { ...test.scores } } : null,
    verdict: script.verdict,
    edited,
  }
}

const presentScripts = (scripts: ScriptSet): ScriptSetDto => {
  const { candidates, recommended, chosen, writtenAt } = scripts.props
  return {
    candidates: candidates.map(presentScript),
    recommended,
    chosen: chosen ? { index: chosen.index, script: presentScript(chosen.script) } : null,
    writtenAt: writtenAt.toISOString(),
  }
}

/** One style per persona, in their order: a persona nobody chose or proposed anything for gets the default. */
const presentStyles = (project: ProjectSnapshot): PersonaStyleDto[] => {
  const personas = project.personas.status === 'succeeded' ? project.personas.personas.all : []
  return personas.map(({ name }) => {
    const known = project.styles.find((style) => style.persona === name)
    const { look, tone, sound } = known?.choice ?? known?.suggestion ?? DEFAULT_STYLE
    return { persona: name, style: { look, tone, sound }, suggestion: known?.suggestion ? { ...known.suggestion } : null, chosen: Boolean(known?.choice) }
  })
}

export const presentProject = (project: ProjectSnapshot): ProjectDto => ({
  id: project.id,
  folder: { path: project.folder.path, name: project.folder.name },
  analysis: presentAnalysis(project.analysis),
  personas: presentPersonas(project.personas),
  videos: project.videos.map(({ persona, state, scripts }) => ({
    persona,
    video: presentVideo(project.id, persona, state),
    scripts: scripts ? presentScripts(scripts) : null,
  })),
  videoSetup: {
    production: project.videoSetup.props.production,
    demo: { mode: project.videoSetup.props.demo.mode, addresses: [...project.videoSetup.props.demo.addresses] },
    track: project.videoSetup.props.track,
  },
  styles: presentStyles(project),
  createdAt: project.createdAt.toISOString(),
})
