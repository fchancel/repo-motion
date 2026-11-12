import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ProcessOutcome, ProcessRunner } from '../claude-code/process-runner'

export interface ScriptRun {
  /** The Node executable. */
  readonly node: string
  readonly script: string
  /** Where the job is written for the script to read; removed once it has run. */
  readonly jobFile: string
  readonly job: object
  readonly timeoutMs: number
  /** Called with each JSON object the script prints. */
  readonly onMessage: (message: unknown) => void
}

/**
 * Runs a script of the video package in its own Node process: React, the bundler and the
 * headless browser stay out of the application's server. The script reads a job from a
 * file and answers with one JSON object per line.
 */
export const runVideoScript = async (run: ProcessRunner, options: ScriptRun): Promise<ProcessOutcome> => {
  await mkdir(dirname(options.jobFile), { recursive: true })
  await writeFile(options.jobFile, JSON.stringify(options.job), 'utf8')
  try {
    return await run(options.node, [options.script, options.jobFile], {
      timeoutMs: options.timeoutMs,
      onLine: (line) => {
        try {
          options.onMessage(JSON.parse(line))
        } catch {
          // Not JSON: something a dependency printed.
        }
      },
    })
  } finally {
    await rm(options.jobFile, { force: true })
  }
}

/** The last line of what a script wrote on its error output is usually the cause. */
export const lastErrorLine = (stderr: string): string => {
  const last = stderr.trim().split('\n').at(-1)?.trim()
  return last ? ` : ${last.slice(0, 300)}` : '.'
}
