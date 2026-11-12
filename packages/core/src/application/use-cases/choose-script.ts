import type { InvalidVideoTransition, PersonaNotFound, ProjectId, ProjectSnapshot } from '../../domain/project/project'
import type { InvalidScript } from '../../domain/video/script'
import { err, ok, type Result } from '../../shared/result'
import { requireClaudeCode, type ClaudeCodeNotReady } from '../claude-code-readiness'
import { projectNotFound, type ProjectNotFound } from '../errors'
import type { BackgroundJobs } from '../ports/background-jobs'
import type { ClaudeCode } from '../ports/claude-code'
import type { ProjectRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'

export interface ChooseScriptCommand {
  readonly projectId: ProjectId
  /** Name of the persona the video is for. */
  readonly persona: string
  /** Which of the scripts written for that video. */
  readonly index: number
  /** The user's own words on screen, one per beat of that script. Null: the script as written. */
  readonly texts: readonly string[] | null
}

export type ChooseScriptError = ProjectNotFound | ClaudeCodeNotReady | PersonaNotFound | InvalidVideoTransition | InvalidScript

/** The user picks the script of a video: it is then made from it, in the background (see `ProduceVideo`). */
export class ChooseScript {
  constructor(
    private readonly deps: {
      readonly projects: ProjectRepository
      readonly claudeCode: ClaudeCode
      readonly jobs: BackgroundJobs
      readonly clock: Clock
    },
  ) {}

  async execute(command: ChooseScriptCommand): Promise<Result<ProjectSnapshot, ChooseScriptError>> {
    const { projects, claudeCode, jobs, clock } = this.deps

    const ready = await requireClaudeCode(claudeCode)
    if (!ready.ok) return ready

    const chosen = await projects.update(command.projectId, (project) => {
      const result = project.chooseScript(command.persona, { index: command.index, texts: command.texts }, clock.now())
      return result.ok ? ok(project.toSnapshot()) : result
    })
    if (!chosen) return err(projectNotFound())
    if (!chosen.ok) return chosen

    await jobs.enqueue({ kind: 'video', projectId: command.projectId, persona: command.persona })
    return chosen
  }
}
