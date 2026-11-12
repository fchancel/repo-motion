import type { ClaudeCode, ClaudeCodeStatus } from '@repo-motion/core'
import type { ClaudeBinaryLocator } from './claude-binary-locator'
import type { ProcessRunner } from './process-runner'

const STATUS_TTL_MS = 5_000
const COMMAND_TIMEOUT_MS = 15_000

/**
 * The Claude Code installed on this machine. We only ask it who it is: signing in is
 * something the user does themselves, in their terminal, with `claude auth login`.
 */
export class ClaudeCodeCli implements ClaudeCode {
  private cached: { status: ClaudeCodeStatus; at: number } | null = null

  constructor(
    private readonly run: ProcessRunner,
    private readonly binary: ClaudeBinaryLocator,
    private readonly now: () => number = Date.now,
  ) {}

  async status(): Promise<ClaudeCodeStatus> {
    if (this.cached && this.now() - this.cached.at < STATUS_TTL_MS) return this.cached.status
    const status = await this.probe()
    this.cached = { status, at: this.now() }
    return status
  }

  private async probe(): Promise<ClaudeCodeStatus> {
    const located = await this.binary.find()
    if (!located) return { state: 'missing' }
    const { path, version } = located

    const authRun = await this.run(path, ['auth', 'status'], { timeoutMs: COMMAND_TIMEOUT_MS })
    // Older versions have no `auth status`: assume it is usable, the analysis will say otherwise.
    const signedIn = authRun.kind === 'exited' ? readLoggedIn(authRun.stdout) : null
    return { state: signedIn === false ? 'signed_out' : 'ready', version, executable: path }
  }
}

const readLoggedIn = (stdout: string): boolean | null => {
  try {
    const parsed = JSON.parse(stdout) as { loggedIn?: unknown }
    return typeof parsed.loggedIn === 'boolean' ? parsed.loggedIn : null
  } catch {
    return null
  }
}
