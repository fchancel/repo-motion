import { readdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import type { FolderNotFound, ProjectFolders, Result } from '@repo-motion/core'
import { ProjectFolder, err, ok } from '@repo-motion/core'

const MAX_SUGGESTIONS = 8
const NOISE = new Set(['node_modules', 'Library', 'dist', 'build', 'vendor'])

const notFound = (input: string, why: string): FolderNotFound => ({
  type: 'FolderNotFound',
  message: `« ${input} » ${why}`,
})

/** The folders of this machine, seen through Node's file system API. */
export class NodeProjectFolders implements ProjectFolders {
  /** `baseFolder`: what relative paths are resolved against (the folder the app was launched from). */
  constructor(
    private readonly baseFolder: string = homedir(),
    private readonly home: string = homedir(),
  ) {}

  async resolve(input: string): Promise<Result<ProjectFolder, FolderNotFound>> {
    const typed = input.trim()
    if (!typed) return err(notFound(input, "n'est pas un chemin."))

    const path = this.expand(typed)
    try {
      if (!(await stat(path)).isDirectory()) return err(notFound(typed, "n'est pas un dossier."))
      // Two ways of writing the same folder (symlink, `..`) must give the same project.
      const folder = ProjectFolder.of(await realpath(path))
      return folder.ok ? ok(folder.value) : err(notFound(typed, "n'est pas un dossier."))
    } catch {
      return err(notFound(typed, 'est introuvable sur cette machine.'))
    }
  }

  async suggest(input: string): Promise<string[]> {
    const typed = input.trim()
    if (!typed) return []

    const path = this.expand(typed)
    // "~/Proj" completes inside "~" with the prefix "Proj"; "~/Projects/" lists its content.
    const listsFolder = typed.endsWith('/') || typed.endsWith(sep) || typed === '~'
    const parent = listsFolder ? path : dirname(path)
    const prefix = listsFolder ? '' : basename(path).toLowerCase()

    try {
      const entries = await readdir(parent, { withFileTypes: true })
      return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !NOISE.has(entry.name))
        .filter((entry) => entry.name.toLowerCase().startsWith(prefix))
        .map((entry) => join(parent, entry.name))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, MAX_SUGGESTIONS)
    } catch {
      return []
    }
  }

  private expand(typed: string): string {
    if (typed === '~') return this.home
    if (typed.startsWith('~/') || typed.startsWith(`~${sep}`)) return join(this.home, typed.slice(2))
    return resolve(this.baseFolder, typed)
  }
}
