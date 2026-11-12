import type { BriefRequired, InvalidPersonasTransition, ProjectId, ProjectSnapshot } from '../../domain/project/project'
import { err, ok, type Result } from '../../shared/result'
import { requireClaudeCode, type ClaudeCodeNotReady } from '../claude-code-readiness'
import { projectNotFound, type ProjectNotFound } from '../errors'
import type { BackgroundJobs } from '../ports/background-jobs'
import type { ClaudeCode } from '../ports/claude-code'
import type { ProjectRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'

export interface RequestPersonasCommand {
  readonly projectId: ProjectId
}

export type RequestPersonasError = ProjectNotFound | ClaudeCodeNotReady | BriefRequired | InvalidPersonasTransition

/** Queues the writing of the personas. The work itself runs in the background (see `WritePersonas`). */
export class RequestPersonas {
  constructor(
    private readonly deps: {
      readonly projects: ProjectRepository
      readonly claudeCode: ClaudeCode
      readonly jobs: BackgroundJobs
      readonly clock: Clock
    },
  ) {}

  async execute(command: RequestPersonasCommand): Promise<Result<ProjectSnapshot, RequestPersonasError>> {
    const { projects, claudeCode, jobs, clock } = this.deps

    const project = await projects.findById(command.projectId)
    if (!project) return err(projectNotFound())

    const ready = await requireClaudeCode(claudeCode)
    if (!ready.ok) return ready

    const requested = project.requestPersonas(clock.now())
    if (!requested.ok) return requested

    await projects.save(project)
    await jobs.enqueue({ kind: 'personas', projectId: project.id })
    return ok(project.toSnapshot())
  }
}
