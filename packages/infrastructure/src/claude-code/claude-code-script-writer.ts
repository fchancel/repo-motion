import type { Persona, ProductBrief, Result, ScriptWriter, ScriptWritingFailed, ScriptWritingRequest, ViewerTest, WrittenScripts } from '@repo-motion/core'
import { Script, err, ok, scriptStrength } from '@repo-motion/core'
import { z } from 'zod'
import type { AnswerRejected, ClaudePromptRunner } from './claude-prompt-runner'
import {
  SCRIPT_SYSTEM_PROMPT,
  SCRIPTS_SCHEMA,
  VIEWER_SCHEMA,
  VIEWER_SYSTEM_PROMPT,
  revisionPrompt,
  revisionSchema,
  scriptPrompt,
  viewerPrompt,
} from './script-prompt'

/** Shape check of one script. Its rules (hook, context early, reading time…) are enforced by `Script.create`. */
const scriptAnswer = z.object({
  format: z.string(),
  angle: z.string(),
  openLoop: z.string().nullable().default(null),
  beats: z.array(z.object({ role: z.string(), onScreen: z.string().default(''), visual: z.string(), seconds: z.number() })),
  post: z.object({ caption: z.string(), hashtags: z.array(z.string()) }),
})

const firstAnswer = z.object({ productInOneSentence: z.string(), scripts: z.array(scriptAnswer) })
const revisionAnswer = z.object({ scripts: z.array(scriptAnswer), recommended: z.number().int().default(0) })

const viewerAnswer = z.object({
  firstImpression: z.string().default(''),
  leftInBeat: z.number().int().nullable(),
  why: z.string().default(''),
  understoodInBeat: z.number().int().nullable(),
  whatItIs: z.string(),
  whatFor: z.string().default(''),
  confusing: z.array(z.string()).default([]),
  scores: z.object({ hook: z.number(), clarity: z.number(), retention: z.number() }),
})
type ViewerReport = z.infer<typeof viewerAnswer>

/** The video's typefaces have no emoji: one that slipped in would render as an empty box. */
const clean = (text: string): string =>
  text
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

const problemsOf = (error: z.ZodError): string =>
  error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
    .join('\n')

interface ReadScripts {
  /** The scripts the domain accepts, with where each one was in the answer. */
  readonly scripts: readonly { readonly at: number; readonly script: Script }[]
}

/**
 * Turns the scripts Claude wrote into scripts the domain accepts. The first answer must be
 * entirely right; once Claude has had its chance to fix it, the scripts that hold are kept.
 */
const scriptsReader = (brief: ProductBrief) => {
  let attempts = 0
  return (drafts: readonly z.infer<typeof scriptAnswer>[]): Result<ReadScripts, AnswerRejected> => {
    attempts += 1
    const read = drafts.map((draft) =>
      Script.create(
        {
          ...draft,
          angle: clean(draft.angle),
          openLoop: draft.openLoop ? clean(draft.openLoop) : null,
          beats: draft.beats.map((beat) => ({ ...beat, onScreen: clean(beat.onScreen), visual: clean(beat.visual) })),
          post: { caption: draft.post.caption.trim(), hashtags: draft.post.hashtags.map((hashtag) => hashtag.trim()) },
        },
        brief,
      ),
    )
    const scripts = read.flatMap((script, at) => (script.ok ? [{ at, script: script.value }] : []))
    if (scripts.length === drafts.length || (attempts > 1 && scripts.length > 0)) return ok({ scripts })

    const problems = read.flatMap((script, at) => (script.ok ? [] : script.error.violations.map((violation) => `scripts[${at}] : ${violation}`)))
    return err({ problems: problems.join('\n') || 'Aucun script.' })
  }
}

/** The beat a viewer named (from 1), as an index of the script's beats. */
const beatIndex = (value: number | null, script: Script): number | null =>
  value === null ? null : Math.min(Math.max(Math.round(value), 1), script.props.beats.length) - 1

const clampScore = (value: number): number => Math.round(Math.min(Math.max(value, 0), 10))

/**
 * Viewers name beats, not seconds: asked for a second, they round to where a beat ends. The
 * time is computed here: understood once the beat that made it clear is over, left as the
 * beat they left on starts. Leaving on the last beat is watching to the end.
 */
const toTest = (report: ViewerReport, script: Script): ViewerTest => {
  const starts = script.starts
  const understood = beatIndex(report.understoodInBeat, script)
  const left = beatIndex(report.leftInBeat, script)
  const end = (index: number) => Math.round(((starts[index] ?? 0) + (script.props.beats[index]?.seconds ?? 0)) * 10) / 10
  return {
    whatItIs: report.whatItIs.trim(),
    whatFor: report.whatFor.trim(),
    understoodAt: understood === null ? null : end(understood),
    leftAt: left === null || left === script.props.beats.length - 1 ? null : (starts[left] ?? 0),
  why: report.why.trim(),
  confusing: report.confusing.map((line) => line.trim()).filter(Boolean),
    scores: { hook: clampScore(report.scores.hook), clarity: clampScore(report.scores.clarity), retention: clampScore(report.scores.retention) },
  }
}

/** The writers' pick, unless the viewers clearly preferred another one. */
export const pickRecommended = (candidates: readonly Script[], proposed: number): number => {
  const strengths = candidates.map(scriptStrength)
  const best = strengths.indexOf(Math.max(...strengths))
  const mine = strengths[proposed]
  if (mine === undefined) return Math.max(best, 0)
  // A better verdict (pass over weak, weak over fail) is worth 100: scores alone do not overrule the writers.
  return (strengths[best] ?? 0) - mine >= 100 ? best : proposed
}

const WRITE_TIMEOUT_MS = 6 * 60_000
const VIEWER_TIMEOUT_MS = 2 * 60_000

const failed = (message: string, retryable: boolean): ScriptWritingFailed => ({ type: 'ScriptWritingFailed', message, retryable })

/**
 * Has the user's Claude Code write several scripts for one persona's video, then has each
 * one watched by another run of Claude that is given only the screen, and rewritten where
 * that viewer got lost. No tool at all: everything needed is in the prompts.
 */
export class ClaudeCodeScriptWriter implements ScriptWriter {
  constructor(private readonly claude: ClaudePromptRunner) {}

  async write(request: ScriptWritingRequest): Promise<Result<WrittenScripts, ScriptWritingFailed>> {
    const { brief, persona, direction, screens, folder } = request
    const say = (activity: string) => request.onActivity?.(activity)

    say("Cherche l'angle et écrit trois scripts")
    const readFirst = scriptsReader(brief)
    let productInOneSentence = brief.props.tagline
    const first = await this.claude.askFor(
      {
        prompt: scriptPrompt(brief, persona, direction, screens),
        systemPrompt: SCRIPT_SYSTEM_PROMPT,
        schema: SCRIPTS_SCHEMA,
        tools: '',
        cwd: folder.path,
        timeoutMs: WRITE_TIMEOUT_MS,
      },
      (answer) => {
        const parsed = firstAnswer.safeParse(answer)
        if (!parsed.success) return err({ problems: problemsOf(parsed.error) })
        productInOneSentence = parsed.data.productInOneSentence.trim() || productInOneSentence
        return readFirst(parsed.data.scripts)
      },
      () => say('Corrige les scripts qui ne tiennent pas les règles'),
    )
    if (!first.ok) return err(failed(first.error.message, first.error.retryable))
    const written = first.value.scripts.map(({ script }) => script)

    say('Des spectateurs qui ne connaissent pas le produit regardent les scripts')
    const reports = await this.watchAll(written, persona, folder.path)
    if (reports.every((report) => report === null)) return ok({ candidates: written, recommended: 0 })
    const tested = written.map((script, index) => withReport(script, reports[index] ?? null))

    say('Réécrit là où les spectateurs ont décroché')
    const readRevision = scriptsReader(brief)
    let proposed = 0
    const revised = await this.claude.askFor(
      {
        prompt: revisionPrompt(
          brief,
          persona,
          productInOneSentence,
          written.map((script, index) => ({ script, report: reports[index] ?? 'This viewer could not watch it.' })),
        ),
        systemPrompt: SCRIPT_SYSTEM_PROMPT,
        schema: revisionSchema(written.length),
        tools: '',
        cwd: folder.path,
        timeoutMs: WRITE_TIMEOUT_MS,
      },
      (answer) => {
        const parsed = revisionAnswer.safeParse(answer)
        if (!parsed.success) return err({ problems: problemsOf(parsed.error) })
        const read = readRevision(parsed.data.scripts)
        if (read.ok) proposed = Math.max(0, read.value.scripts.findIndex(({ at }) => at === parsed.data.recommended))
        return read
      },
    )
    // The first scripts, tested, are worth more than nothing.
    if (!revised.ok) return ok({ candidates: tested, recommended: pickRecommended(tested, 0) })

    say('Fait regarder les scripts réécrits à de nouveaux spectateurs')
    const rewritten = revised.value.scripts.map(({ script }) => script)
    const retests = await this.watchAll(rewritten, persona, folder.path)
    const candidates = rewritten.map((script, index) => withReport(script, retests[index] ?? null))
    return ok({ candidates, recommended: pickRecommended(candidates, proposed) })
  }

  /** Each script watched by its own viewer, at the same time. A viewer that could not watch is left out. */
  private watchAll(scripts: readonly Script[], persona: Persona, cwd: string): Promise<(ViewerReport | null)[]> {
    return Promise.all(
      scripts.map(async (script) => {
        const answer = await this.claude.ask({
          prompt: viewerPrompt(script, persona),
          systemPrompt: VIEWER_SYSTEM_PROMPT,
          schema: VIEWER_SCHEMA,
          tools: '',
          cwd,
          timeoutMs: VIEWER_TIMEOUT_MS,
        })
        if (!answer.ok) return null
        const parsed = viewerAnswer.safeParse(answer.value)
        return parsed.success ? parsed.data : null
      }),
    )
  }
}

const withReport = (script: Script, report: ViewerReport | null): Script => (report ? script.tested(toTest(report, script)) : script)
