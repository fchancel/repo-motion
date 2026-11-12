import type { InvalidVideoTransition, PersonaNotFound, ProjectId, ProjectSnapshot } from '../../domain/project/project'
import { err, ok, type Result } from '../../shared/result'
import { requireClaudeCode, type ClaudeCodeNotReady } from '../claude-code-readiness'
import { projectNotFound, type ProjectNotFound } from '../errors'
import type { BackgroundJobs } from '../ports/background-jobs'
import type { ClaudeCode } from '../ports/claude-code'
import type { ProjectRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'

export interface RequestVideoCommand {
  readonly projectId: ProjectId
  /** Name of the persona the video is for. */
  readonly persona: string
}

export type RequestVideoError = ProjectNotFound | ClaudeCodeNotReady | PersonaNotFound | InvalidVideoTransition

/** Queues one persona's video. The work itself runs in the background (see `ProduceVideo`). */
export class RequestVideo {
  constructor(
    private readonly deps: {
      readonly projects: ProjectRepository
      readonly claudeCode: ClaudeCode
      readonly jobs: BackgroundJobs
      readonly clock: Clock
    },
  ) {}

  async execute(command: RequestVideoCommand): Promise<Result<ProjectSnapshot, RequestVideoError>> {
    const { projects, claudeCode, jobs, clock } = this.deps

    const ready = await requireClaudeCode(claudeCode)
    if (!ready.ok) return ready

    // Other videos of the same project may be in production right now: change it atomically.
    const requested = await projects.update(command.projectId, (project) => {
      const result = project.requestVideo(command.persona, clock.now())
      return result.ok ? ok(project.toSnapshot()) : result
    })
    if (!requested) return err(projectNotFound())
    if (!requested.ok) return requested

    await jobs.enqueue({ kind: 'video', projectId: command.projectId, persona: command.persona })
    return requested
  }
}
