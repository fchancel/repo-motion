import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export type ProcessOutcome =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'timed_out' }
  | { readonly kind: 'exited'; readonly exitCode: number | null; readonly stdout: string; readonly stderr: string }

export interface RunOptions {
  readonly cwd?: string
  readonly timeoutMs: number
  /** Called for each complete line of standard output, as it arrives. */
  readonly onLine?: (line: string) => void
}

/** Runs a program and reports how it ended. Never throws: tests replace it with a script. */
export type ProcessRunner = (command: string, args: readonly string[], options: RunOptions) => Promise<ProcessOutcome>

const STDERR_LIMIT = 8_000

export const runProcess: ProcessRunner = (command, args, options) =>
  new Promise((resolve) => {
    // No shell: arguments are passed as-is, so nothing in them can be interpreted as a command.
    const child = spawn(command, [...args], { cwd: options.cwd, stdio: ['ignore', 'pipe', 'pipe'] })

    const lines: string[] = []
    let stderr = ''
    let settled = false
    const settle = (outcome: ProcessOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(outcome)
    }

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 5_000).unref()
      settle({ kind: 'timed_out' })
    }, options.timeoutMs)

    createInterface({ input: child.stdout }).on('line', (line) => {
      lines.push(line)
      options.onLine?.(line)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-STDERR_LIMIT)
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      settle(error.code === 'ENOENT' ? { kind: 'not_found' } : { kind: 'exited', exitCode: null, stdout: '', stderr: error.message })
    })
    child.on('close', (exitCode) => settle({ kind: 'exited', exitCode, stdout: lines.join('\n'), stderr }))
  })
