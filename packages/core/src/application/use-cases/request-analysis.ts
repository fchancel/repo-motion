import type { InvalidAnalysisTransition, ProjectId, ProjectSnapshot } from '../../domain/project/project'
import { err, ok, type Result } from '../../shared/result'
import { requireClaudeCode, type ClaudeCodeNotReady } from '../claude-code-readiness'
import { projectNotFound, type ProjectNotFound } from '../errors'
import type { BackgroundJobs } from '../ports/background-jobs'
import type { ClaudeCode } from '../ports/claude-code'
import type { ProjectRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'

export interface RequestAnalysisCommand {
  readonly projectId: ProjectId
}

export type RequestAnalysisError = ProjectNotFound | ClaudeCodeNotReady | InvalidAnalysisTransition

/** Queues the codebase analysis. The work itself runs in the background (see `RunAnalysis`). */
export class RequestAnalysis {
  constructor(
    private readonly deps: {
      readonly projects: ProjectRepository
      readonly claudeCode: ClaudeCode
      readonly jobs: BackgroundJobs
      readonly clock: Clock
    },
  ) {}

  async execute(command: RequestAnalysisCommand): Promise<Result<ProjectSnapshot, RequestAnalysisError>> {
    const { projects, claudeCode, jobs, clock } = this.deps

    const project = await projects.findById(command.projectId)
    if (!project) return err(projectNotFound())

    const ready = await requireClaudeCode(claudeCode)
    if (!ready.ok) return ready

    const requested = project.requestAnalysis(clock.now())
    if (!requested.ok) return requested

    await projects.save(project)
    await jobs.enqueue({ kind: 'analysis', projectId: project.id })
    return ok(project.toSnapshot())
  }
}
