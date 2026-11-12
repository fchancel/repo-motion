import type { PersonaNotFound, ProjectId, ProjectSnapshot } from '../../domain/project/project'
import { createVideoStyle, type InvalidVideoStyle, type VideoStyleDraft } from '../../domain/video/direction'
import { err, ok, type Result } from '../../shared/result'
import { projectNotFound, type ProjectNotFound } from '../errors'
import type { ProjectRepository } from '../ports/repositories'

export interface ChooseStyleCommand {
  readonly projectId: ProjectId
  /** Null: the choice is made for every persona at once. */
  readonly persona: string | null
  /** Null: go back to what Claude proposed. */
  readonly style: VideoStyleDraft | null
}

export type ChooseStyleError = ProjectNotFound | PersonaNotFound | InvalidVideoStyle

/**
 * Records how the user wants a persona's videos to look, speak and sound, in place of
 * what Claude proposed. Applies to the videos asked for from then on.
 */
export class ChooseStyle {
  constructor(private readonly deps: { readonly projects: ProjectRepository }) {}

  async execute(command: ChooseStyleCommand): Promise<Result<ProjectSnapshot, ChooseStyleError>> {
    const style = command.style ? createVideoStyle(command.style) : ok(null)
    if (!style.ok) return style

    const chosen = await this.deps.projects.update(command.projectId, (project) => {
      const result = project.chooseStyle(command.persona, style.value)
      return result.ok ? ok(project.toSnapshot()) : result
    })
    return chosen ?? err(projectNotFound())
  }
}
