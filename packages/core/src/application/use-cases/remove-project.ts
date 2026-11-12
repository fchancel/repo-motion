import type { ProjectId } from '../../domain/project/project'
import type { Failure } from '../../shared/errors'
import { err, okVoid, type Result } from '../../shared/result'
import { projectNotFound, type ProjectNotFound } from '../errors'
import type { ProjectRepository } from '../ports/repositories'
import type { AppCapturer, VideoDirector, VideoRenderer } from '../ports/video'

export type WorkInProgress = Failure<'WorkInProgress'>

/** Forgets a project and deletes its videos and the pictures taken for them. The folder itself is never touched. */
export class RemoveProject {
  constructor(
    private readonly deps: {
      readonly projects: ProjectRepository
      readonly videoRenderer: VideoRenderer
      readonly appCapturer: AppCapturer
      readonly videoDirector: VideoDirector
    },
  ) {}

  async execute({ projectId }: { readonly projectId: ProjectId }): Promise<Result<void, ProjectNotFound | WorkInProgress>> {
    const project = await this.deps.projects.findById(projectId)
    if (!project) return err(projectNotFound())
    if (project.isBusy) {
      return err({ type: 'WorkInProgress', message: 'Attendez la fin du travail en cours avant de retirer ce projet.' })
    }

    await this.deps.projects.remove(projectId)
    await this.deps.videoRenderer.discard(projectId)
    await this.deps.appCapturer.discard(projectId)
    await this.deps.videoDirector.discard(projectId)
    return okVoid
  }
}
