import { err, ok, type Result } from '@repo-motion/core'
import type { ProcessRunner } from './process-runner'
import { readResult, type ResultEvent } from './stream-events'

export interface ClaudeRunFailed {
  readonly message: string
  /** True when trying again may succeed (rate limit, timeout), false when the setup is the problem. */
  readonly retryable: boolean
}

export interface ClaudePromptRunnerOptions {
  /** Finds the `claude` executable; `null` when Claude Code is not installed. */
  readonly binary: () => Promise<string | null>
  /** Leave unset to use the model the user configured in Claude Code. */
  readonly model?: string
}

export interface ClaudeQuestion {
  readonly prompt: string
  readonly systemPrompt: string
  /** JSON Schema of the answer: Claude Code validates it before handing it back. */
  readonly schema: object
  /** Built-in tools Claude may use, comma-separated. Empty: none. */
  readonly tools: string
  readonly cwd: string
  readonly timeoutMs: number
  readonly onLine?: (line: string) => void
  /**
   * Lets Claude work as an agent in `cwd`: it may write files there, and run the commands
   * listed here, each given as the exact start of a command line. Everything else is
   * refused: another command, a file outside `cwd`, the network.
   */
  readonly agent?: { readonly commands: readonly string[] }
}

/** Why an answer cannot be used, worded so it can be sent back to Claude to fix. */
export interface AnswerRejected {
  readonly problems: string
}

const REPAIR_TIMEOUT_MS = 3 * 60_000
const failed = (message: string, retryable: boolean): ClaudeRunFailed => ({ message, retryable })
const NOT_INSTALLED = failed("Claude Code n'est pas installé sur cette machine.", false)

/**
 * Runs the user's own Claude Code (`claude -p`), with their own sign-in. Nothing leaves
 * the machine through this application, and no credential passes through it.
 */
export class ClaudePromptRunner {
  constructor(
    private readonly run: ProcessRunner,
    private readonly options: ClaudePromptRunnerOptions,
  ) {}

  /**
   * Asks, then lets the domain judge the answer (`read`). If it is refused, Claude gets
   * one chance to fix it, without tools: the model proposes, the domain guarantees.
   */
  async askFor<T>(
    question: ClaudeQuestion,
    read: (answer: unknown) => Result<T, AnswerRejected>,
    onRepair?: () => void,
  ): Promise<Result<T, ClaudeRunFailed>> {
    const answer = await this.ask(question)
    if (!answer.ok) return answer

    const first = read(answer.value)
    if (first.ok) return first

    onRepair?.()
    const repaired = await this.ask({
      ...question,
      prompt: `This answer was rejected:\n\n${JSON.stringify(answer.value, null, 2)}\n\nProblems to fix:\n${first.error.problems}\n\nReturn the corrected answer. Change only what the problems require.`,
      tools: '',
      timeoutMs: REPAIR_TIMEOUT_MS,
    })
    if (!repaired.ok) return repaired

    const second = read(repaired.value)
    return second.ok ? second : err(failed(`Claude a rendu une réponse inexploitable :\n${second.error.problems}`, true))
  }

  /** One `claude -p` run. Returns the structured answer, or why there is none. */
  async ask(question: ClaudeQuestion): Promise<Result<unknown, ClaudeRunFailed>> {
    const binary = await this.options.binary()
    if (!binary) return err(NOT_INSTALLED)

    let result: ResultEvent | null = null
    const outcome = await this.run(binary, this.arguments(question), {
      cwd: question.cwd,
      timeoutMs: question.timeoutMs,
      onLine: (line) => {
        result = readResult(line) ?? result
        question.onLine?.(line)
      },
    })

    if (outcome.kind === 'not_found') return err(NOT_INSTALLED)
    if (outcome.kind === 'timed_out') {
      const minutes = Math.round(question.timeoutMs / 60_000)
      return err(failed(`Claude a dépassé ${minutes} minutes et a été arrêté.`, true))
    }

    const final = result as ResultEvent | null
    if (!final) {
      const detail = outcome.stderr.trim().split('\n').at(-1) ?? `code de sortie ${outcome.exitCode}`
      return err(failed(`Claude Code s'est arrêté sans réponse : ${detail}`, true))
    }
    if (final.is_error || (final.subtype !== undefined && final.subtype !== 'success')) return err(explain(final))

    return ok(final.structured_output ?? extractJson(final.result ?? ''))
  }

  private arguments(question: ClaudeQuestion): string[] {
    return [
      '-p',
      question.prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--json-schema',
      JSON.stringify(question.schema),
      '--append-system-prompt',
      question.systemPrompt,
      '--tools',
      question.tools,
      // Anything that would ask for a permission is refused: nobody is there to answer.
      // An agent's edits inside its folder ask for none; its commands are allowed one by one.
      '--permission-mode',
      question.agent ? 'acceptEdits' : 'dontAsk',
      ...(question.agent && question.agent.commands.length > 0 ? ['--allowedTools', ...question.agent.commands.map((command) => `Bash(${command}:*)`)] : []),
      // Keep the run hermetic: no hooks or settings from the project's folder, no MCP server, no skill.
      '--setting-sources',
      'user',
      '--strict-mcp-config',
      '--disable-slash-commands',
      // These runs must not appear among the user's own Claude Code conversations.
      '--no-session-persistence',
      ...(this.options.model ? ['--model', this.options.model] : []),
    ]
  }
}

/** The JSON object inside a text answer, whether bare or wrapped in a code fence or a sentence. */
export const extractJson = (text: string): unknown => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

/** Turns Claude Code's own failure into something the user can act on. */
const explain = (result: ResultEvent): ClaudeRunFailed => {
  const text = (result.result ?? '').trim()

  if (/not logged in|\/login|authentication/i.test(text)) {
    return failed("Claude Code n'est pas connecté. Lancez « claude auth login » dans un terminal, puis réessayez.", false)
  }
  if (/limit/i.test(text)) return failed(`Claude Code a atteint une limite d'utilisation : ${text}`, true)
  if (result.subtype === 'error_max_turns') return failed("Le travail était trop long et s'est arrêté.", true)

  return failed(text ? `Claude Code a signalé une erreur : ${text.slice(0, 400)}` : "Claude Code s'est arrêté sur une erreur.", true)
}
