import { join } from 'node:path'
import {
  AddProject,
  ChooseScript,
  ChooseStyle,
  GetClaudeCodeStatus,
  GetProject,
  GetVideoFile,
  ListProjects,
  ProduceVideo,
  RecoverInterruptedWork,
  RemoveProject,
  RequestAnalysis,
  RequestPersonas,
  RequestVideo,
  RunAnalysis,
  SetUpVideos,
  SuggestFolders,
  SuggestStyles,
  WritePersonas,
  type BackgroundJob,
} from '@repo-motion/core'
import { ClaudeBinaryLocator, defaultClaudeCandidates } from './claude-code/claude-binary-locator'
import { ClaudeCodeCli } from './claude-code/claude-code-cli'
import { ClaudeCodeCodebaseAnalyzer } from './claude-code/claude-code-codebase-analyzer'
import { ClaudeCodeDemoScout } from './claude-code/claude-code-demo-scout'
import { ClaudeCodePersonaWriter } from './claude-code/claude-code-persona-writer'
import { ClaudeCodeScriptWriter } from './claude-code/claude-code-script-writer'
import { ClaudeCodeStoryboardWriter } from './claude-code/claude-code-storyboard-writer'
import { ClaudeCodeStyleAdvisor } from './claude-code/claude-code-style-advisor'
import { ClaudeCodeVideoDirector } from './claude-code/claude-code-video-director'
import { ClaudePromptRunner } from './claude-code/claude-prompt-runner'
import { runProcess } from './claude-code/process-runner'
import { captureScriptBeside, findRenderScript, studioBeside, type InfrastructureConfig } from './config'
import { NodeAudioTracks } from './filesystem/node-audio-tracks'
import { NodeProjectFolders } from './filesystem/node-project-folders'
import { FileProjectRepository } from './persistence/file-project-repository'
import { InProcessBackgroundJobs } from './queue/in-process-background-jobs'
import { RandomUuidGenerator, SystemClock } from './system/system'
import { HeadlessAppCapturer } from './video/headless-app-capturer'
import { RemotionVideoRenderer } from './video/remotion-video-renderer'

export type Application = Awaited<ReturnType<typeof createApplication>>

/** Wires the local adapters into the use cases. Everything runs on the user's machine. */
export const createApplication = async (config: InfrastructureConfig) => {
  const clock = new SystemClock()
  const projects = new FileProjectRepository(join(config.REPO_MOTION_HOME, 'projects'))

  const claudeBinary = new ClaudeBinaryLocator(
    runProcess,
    config.REPO_MOTION_CLAUDE_BIN ? [config.REPO_MOTION_CLAUDE_BIN] : defaultClaudeCandidates(),
  )
  const claude = new ClaudePromptRunner(runProcess, {
    binary: () => claudeBinary.path(),
    ...(config.REPO_MOTION_MODEL ? { model: config.REPO_MOTION_MODEL } : {}),
  })

  // The background side: what each kind of job runs.
  const runAnalysis = new RunAnalysis({
    projects,
    clock,
    analyzer: new ClaudeCodeCodebaseAnalyzer(claude, { timeoutMs: config.REPO_MOTION_ANALYSIS_TIMEOUT_MINUTES * 60_000 }),
  })
  const styleAdvisor = new ClaudeCodeStyleAdvisor(claude)
  const writePersonas = new WritePersonas({ projects, clock, styleAdvisor, personaWriter: new ClaudeCodePersonaWriter(claude) })
  const renderScript = config.REPO_MOTION_RENDER_SCRIPT ?? findRenderScript()
  const videoRenderer = new RemotionVideoRenderer(runProcess, {
    directory: join(config.REPO_MOTION_HOME, 'videos'),
    script: renderScript,
    node: process.execPath,
    timeoutMs: config.REPO_MOTION_RENDER_TIMEOUT_MINUTES * 60_000,
  })
  const appCapturer = new HeadlessAppCapturer(runProcess, {
    directory: join(config.REPO_MOTION_HOME, 'captures'),
    script: captureScriptBeside(renderScript),
    node: process.execPath,
    timeoutMs: 3 * 60_000,
  })
  const videoDirector = new ClaudeCodeVideoDirector(claude, runProcess, {
    directory: join(config.REPO_MOTION_HOME, 'studio'),
    studio: studioBeside(renderScript),
    node: process.execPath,
    timeoutMs: config.REPO_MOTION_DIRECTOR_TIMEOUT_MINUTES * 60_000,
  })
  const produceVideo = new ProduceVideo({
    projects,
    clock,
    appCapturer,
    videoDirector,
    demoScout: new ClaudeCodeDemoScout(claude),
    videoRenderer,
    scriptWriter: new ClaudeCodeScriptWriter(claude),
    storyboardWriter: new ClaudeCodeStoryboardWriter(claude),
  })

  const run = (job: BackgroundJob): Promise<unknown> => {
    switch (job.kind) {
      case 'analysis':
        return runAnalysis.execute(job)
      case 'personas':
        return writePersonas.execute(job)
      case 'video':
        return produceVideo.execute(job)
    }
  }
  const jobs = new InProcessBackgroundJobs(run)

  const deps = {
    clock,
    projects,
    jobs,
    videoRenderer,
    appCapturer,
    videoDirector,
    styleAdvisor,
    audioTracks: new NodeAudioTracks(),
    ids: new RandomUuidGenerator(),
    folders: new NodeProjectFolders(config.REPO_MOTION_LAUNCH_DIR),
    claudeCode: new ClaudeCodeCli(runProcess, claudeBinary),
  }

  // Work cut short by the previous shutdown can never finish: let the user relaunch it.
  await new RecoverInterruptedWork(deps).execute()

  return {
    /** The folder the application was launched from, if any: offered as the first project. */
    launchFolder: config.REPO_MOTION_LAUNCH_DIR ?? null,
    useCases: {
      addProject: new AddProject(deps),
      removeProject: new RemoveProject(deps),
      listProjects: new ListProjects(deps),
      getProject: new GetProject(deps),
      requestAnalysis: new RequestAnalysis(deps),
      requestPersonas: new RequestPersonas(deps),
      requestVideo: new RequestVideo(deps),
      chooseScript: new ChooseScript(deps),
      setUpVideos: new SetUpVideos(deps),
      chooseStyle: new ChooseStyle(deps),
      suggestStyles: new SuggestStyles(deps),
      getVideoFile: new GetVideoFile(deps),
      getClaudeCodeStatus: new GetClaudeCodeStatus(deps),
      suggestFolders: new SuggestFolders(deps),
    },
    async close() {
      await jobs.idle()
    },
  }
}
