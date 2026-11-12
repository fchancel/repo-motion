import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ProcessRunner } from './process-runner'

const VERSION_TIMEOUT_MS = 15_000

/**
 * Where to look for Claude Code. Its installer puts it in `~/.local/bin`, which is often
 * not in the PATH yet (the installer says so, but a running server does not see the fix).
 */
export const defaultClaudeCandidates = (home: string = homedir()): string[] => ['claude', join(home, '.local', 'bin', 'claude')]

export interface LocatedClaude {
  readonly path: string
  readonly version: string
}

/** Finds the Claude Code executable among a few candidates, and remembers which one answered. */
export class ClaudeBinaryLocator {
  private known: string | null = null

  constructor(
    private readonly run: ProcessRunner,
    private readonly candidates: readonly string[],
  ) {}

  /** Asks each candidate for its version, the last working one first. */
  async find(): Promise<LocatedClaude | null> {
    const known = this.known
    const order = known ? [known, ...this.candidates.filter((candidate) => candidate !== known)] : this.candidates

    for (const path of order) {
      const outcome = await this.run(path, ['--version'], { timeoutMs: VERSION_TIMEOUT_MS })
      if (outcome.kind === 'exited' && outcome.exitCode === 0) {
        this.known = path
        return { path, version: outcome.stdout.trim().split(/\s+/)[0] || 'inconnue' }
      }
    }
    this.known = null
    return null
  }

  /** The executable to run, looking for it only if none is known yet. */
  async path(): Promise<string | null> {
    return this.known ?? (await this.find())?.path ?? null
  }
}
