import { Project, ProjectId, type ProjectSnapshot } from '../../domain/project/project'
import type { Failure } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'
import type { FolderNotFound, ProjectFolders } from '../ports/project-folders'
import type { ProjectRepository } from '../ports/repositories'
import type { Clock, IdGenerator } from '../ports/system'

export interface AddProjectCommand {
  /** What the user typed: an absolute path, `~/…` or a relative one. */
  readonly folder: string
}

export interface ProjectAlreadyAdded extends Failure<'ProjectAlreadyAdded'> {
  readonly projectId: ProjectId
}

export type AddProjectError = FolderNotFound | ProjectAlreadyAdded

export class AddProject {
  constructor(
    private readonly deps: {
      readonly projects: ProjectRepository
      readonly folders: ProjectFolders
      readonly ids: IdGenerator
      readonly clock: Clock
    },
  ) {}

  async execute(command: AddProjectCommand): Promise<Result<ProjectSnapshot, AddProjectError>> {
    const { projects, folders, ids, clock } = this.deps

    const folder = await folders.resolve(command.folder)
    if (!folder.ok) return folder

    const existing = (await projects.list()).find((project) => project.folder.equals(folder.value))
    if (existing) {
      return err({
        type: 'ProjectAlreadyAdded',
        message: `${folder.value.name} est déjà dans vos projets.`,
        projectId: existing.id,
      })
    }

    const project = Project.add({ id: ProjectId(ids.next()), folder: folder.value, now: clock.now() })
    await projects.save(project)
    return ok(project.toSnapshot())
  }
}
