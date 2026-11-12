import type { ProjectRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'

const REASON = "L'application a été arrêtée pendant le travail. Relancez-le."

/**
 * Background work runs inside the application's own process. If it was stopped in the
 * middle, nothing will ever finish it: mark it failed at the next start, so it can be relaunched.
 */
export class RecoverInterruptedWork {
  constructor(private readonly deps: { readonly projects: ProjectRepository; readonly clock: Clock }) {}

  async execute(): Promise<{ recovered: number }> {
    const { projects, clock } = this.deps
    const interrupted = (await projects.list()).filter((project) => project.isBusy)

    for (const project of interrupted) {
      // Each call only applies to the stage that was actually pending.
      project.failAnalysis(REASON, clock.now())
      project.failPersonas(REASON, clock.now())
      project.failPendingVideos(REASON, clock.now())
      await projects.save(project)
    }
    return { recovered: interrupted.length }
  }
}
