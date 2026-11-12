import type { ProjectId } from '../../domain/project/project'
import type { PersonaWriter } from '../ports/claude-code'
import type { StyleAdvisor } from '../ports/video'
import type { ProjectRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'

export type WritePersonasOutcome =
  | { readonly status: 'succeeded' }
  | { readonly status: 'failed'; readonly reason: string }
  /** Nothing to do: the project is gone, or its personas are not waiting to be written. */
  | { readonly status: 'skipped'; readonly reason: string }

/**
 * Runs in the background. Every expected failure ends up recorded on the project so the
 * user sees it; only bugs are thrown.
 */
export class WritePersonas {
  constructor(
    private readonly deps: {
      readonly projects: ProjectRepository
      readonly personaWriter: PersonaWriter
      readonly styleAdvisor: StyleAdvisor
      readonly clock: Clock
    },
  ) {}

  async execute({ projectId }: { readonly projectId: ProjectId }): Promise<WritePersonasOutcome> {
    const { projects, personaWriter, styleAdvisor, clock } = this.deps

    const project = await projects.findById(projectId)
    if (!project) return { status: 'skipped', reason: 'Projet introuvable.' }

    const brief = project.brief
    const started = project.startPersonas(clock.now())
    if (!started.ok || !brief) return { status: 'skipped', reason: started.ok ? 'Brief introuvable.' : started.error.message }
    await projects.save(project)

    const personas = await personaWriter.write({ brief, folder: project.folder })

    if (personas.ok) {
      project.completePersonas(personas.value, clock.now())
      await projects.save(project)

      // The personas are there for the user already. A style is then proposed for each;
      // if that fails, nothing is lost: the default applies, and it can be asked for again.
      const styles = await styleAdvisor.suggest({ brief, personas: personas.value, folder: project.folder })
      if (styles.ok) await projects.update(projectId, (current) => current.suggestStyles(styles.value))
      return { status: 'succeeded' }
    }

    project.failPersonas(personas.error.message, clock.now())
    await projects.save(project)
    return { status: 'failed', reason: personas.error.message }
  }
}
