import type { ProjectId } from '../../domain/project/project'
import type { CodebaseAnalyzer } from '../ports/claude-code'
import type { ProjectRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'

export type RunAnalysisOutcome =
  | { readonly status: 'succeeded' }
  | { readonly status: 'failed'; readonly reason: string }
  /** Nothing to do: the project is gone, or its analysis is not waiting to run. */
  | { readonly status: 'skipped'; readonly reason: string }

/**
 * Runs in the background. Every expected failure ends up recorded on the project so the
 * user sees it; only bugs are thrown.
 */
export class RunAnalysis {
  constructor(
    private readonly deps: {
      readonly projects: ProjectRepository
      readonly analyzer: CodebaseAnalyzer
      readonly clock: Clock
    },
  ) {}

  async execute({ projectId }: { readonly projectId: ProjectId }): Promise<RunAnalysisOutcome> {
    const { projects, analyzer, clock } = this.deps

    const project = await projects.findById(projectId)
    if (!project) return { status: 'skipped', reason: 'Projet introuvable.' }

    const started = project.startAnalysis(clock.now())
    if (!started.ok) return { status: 'skipped', reason: started.error.message }
    await projects.save(project)

    // Activity reports are best effort: losing one must never fail the analysis.
    let saving: Promise<void> = Promise.resolve()
    const onActivity = (activity: string) => {
      project.reportActivity(activity)
      saving = saving.then(() => projects.save(project)).catch(() => undefined)
    }

    const brief = await analyzer.analyze({ folder: project.folder, onActivity })
    await saving

    if (brief.ok) {
      project.completeAnalysis(brief.value, clock.now())
      await projects.save(project)
      return { status: 'succeeded' }
    }

    project.failAnalysis(brief.error.message, clock.now())
    await projects.save(project)
    return { status: 'failed', reason: brief.error.message }
  }
}
