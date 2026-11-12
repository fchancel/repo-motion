import type { Failure } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'

export type InvalidProjectFolder = Failure<'InvalidProjectFolder'>

const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/

/** The folder on the user's machine that holds the application's code. */
export class ProjectFolder {
  private constructor(readonly path: string) {}

  /** Expects an absolute, already resolved path: turning `~/app` or `../app` into one is the adapter's job. */
  static of(path: string): Result<ProjectFolder, InvalidProjectFolder> {
    const trimmed = path.trim()
    if (!ABSOLUTE.test(trimmed)) {
      return err({ type: 'InvalidProjectFolder', message: `« ${trimmed} » n'est pas un chemin absolu.` })
    }
    const normalized = trimmed.length > 1 ? trimmed.replace(/[\\/]+$/, '') : trimmed
    return ok(new ProjectFolder(normalized || trimmed))
  }

  /** Last segment of the path: how the project is called until the analysis finds the product's name. */
  get name(): string {
    return this.path.split(/[\\/]/).filter(Boolean).at(-1) ?? this.path
  }

  equals(other: ProjectFolder): boolean {
    return this.path === other.path
  }
}
