import type { Failure } from '../shared/errors'
import { err, okVoid, type Result } from '../shared/result'
import type { ClaudeCode } from './ports/claude-code'

export interface ClaudeCodeNotReady extends Failure<'ClaudeCodeNotReady'> {
  readonly state: 'missing' | 'signed_out'
}

/**
 * Checked before queuing any work for Claude: fail fast, with something the user can
 * act on, rather than minutes later in the background.
 */
export const requireClaudeCode = async (claudeCode: ClaudeCode): Promise<Result<void, ClaudeCodeNotReady>> => {
  const status = await claudeCode.status()

  if (status.state === 'missing') {
    return err({ type: 'ClaudeCodeNotReady', state: 'missing', message: "Claude Code n'est pas installé sur cette machine." })
  }
  if (status.state === 'signed_out') {
    return err({
      type: 'ClaudeCodeNotReady',
      state: 'signed_out',
      message: `Claude Code n'est pas connecté. Lancez « ${status.executable} auth login » dans un terminal.`,
    })
  }
  return okVoid
}
