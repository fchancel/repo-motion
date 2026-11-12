import type { ProjectId, ProjectSnapshot } from '../../domain/project/project'
import type { Failure } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'
import { requireClaudeCode, type ClaudeCodeNotReady } from '../claude-code-readiness'
import { projectNotFound, type ProjectNotFound } from '../errors'
import type { ClaudeCode } from '../ports/claude-code'
import type { ProjectRepository } from '../ports/repositories'
import type { StyleAdvisor, StyleSuggestionFailed } from '../ports/video'

export type PersonasRequired = Failure<'PersonasRequired'>

export type SuggestStylesError = ProjectNotFound | ClaudeCodeNotReady | PersonasRequired | StyleSuggestionFailed

/**
 * Has Claude propose a style for each persona's videos. It is also done right after the
 * personas are written; this is for asking again, or for personas written before that.
 * What the user already chose is kept: a proposal never replaces a choice.
 */
export class SuggestStyles {
  constructor(
    private readonly deps: { readonly projects: ProjectRepository; readonly claudeCode: ClaudeCode; readonly styleAdvisor: StyleAdvisor },
  ) {}

  async execute({ projectId }: { readonly projectId: ProjectId }): Promise<Result<ProjectSnapshot, SuggestStylesError>> {
    const { projects, claudeCode, styleAdvisor } = this.deps

    const project = await projects.findById(projectId)
    if (!project) return err(projectNotFound())

    const brief = project.brief
    const personas = project.personas.status === 'succeeded' ? project.personas.personas : null
    if (!brief || !personas) {
      return err({ type: 'PersonasRequired', message: 'Les styles sont proposés pour des personas : écrivez-les d’abord.' })
    }

    const ready = await requireClaudeCode(claudeCode)
    if (!ready.ok) return ready

    const suggested = await styleAdvisor.suggest({ brief, personas, folder: project.folder })
    if (!suggested.ok) return suggested

    // Videos may be in production meanwhile: the project is changed atomically.
    const saved = await projects.update(projectId, (current) => {
      current.suggestStyles(suggested.value)
      return current.toSnapshot()
    })
    return saved ? ok(saved) : err(projectNotFound())
  }
}
