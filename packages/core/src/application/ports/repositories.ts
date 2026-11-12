import type { Project, ProjectId } from '../../domain/project/project'

export interface ProjectRepository {
  findById(id: ProjectId): Promise<Project | null>
  /** Oldest first. */
  list(): Promise<Project[]>
  save(project: Project): Promise<void>
  remove(id: ProjectId): Promise<void>
  /**
   * Loads the project, applies `change`, and saves it, without letting another update of the
   * same project slip in between. Needed wherever several jobs work on one project at once
   * (its videos). Resolves to what `change` returned, or to null when the project is gone.
   */
  update<T>(id: ProjectId, change: (project: Project) => T): Promise<T | null>
}
