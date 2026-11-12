import type { ProjectFolder } from '../../domain/project/project-folder'
import type { Failure } from '../../shared/errors'
import type { Result } from '../../shared/result'

export type FolderNotFound = Failure<'FolderNotFound'>

/** The folders of the user's machine. */
export interface ProjectFolders {
  /** Turns what the user typed (`~/app`, `./app`, an absolute path) into an existing folder. */
  resolve(input: string): Promise<Result<ProjectFolder, FolderNotFound>>

  /** Folders whose path starts with what the user typed so far, for autocompletion. */
  suggest(input: string): Promise<string[]>
}
