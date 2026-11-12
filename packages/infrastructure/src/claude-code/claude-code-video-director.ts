import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DirectedVideo, Persona, ProjectId, Result, VideoDirectingFailed, VideoDirectingRequest, VideoDirector } from '@repo-motion/core'
import { DirectedPiece, err, ok } from '@repo-motion/core'
import { z } from 'zod'
import { videoFileName } from '../video/remotion-video-renderer'
import type { ClaudePromptRunner, ClaudeQuestion } from './claude-prompt-runner'
import { DIRECTOR_PROMPT, DIRECTOR_REPORT_SCHEMA, DIRECTOR_SYSTEM_PROMPT, directorBrief } from './director-prompt'
import type { ProcessRunner } from './process-runner'
import { readDirectingActivity } from './stream-events'

export interface ClaudeCodeVideoDirectorOptions {
  /** Where the workspaces are kept: one folder per project, one per persona inside. */
  readonly directory: string
  /** The studio of the video package: its guide, its starter and the scripts that draw a piece. Null when it could not be found. */
  readonly studio: string | null
  /** The Node executable that runs those scripts. */
  readonly node: string
  /** How long Claude may work on one video. */
  readonly timeoutMs: number
}

const reportSchema = z.object({
  concept: z.string(),
  shots: z.array(z.object({ label: z.string(), text: z.string().default(''), seconds: z.number() })),
  post: z.object({ caption: z.string(), hashtags: z.array(z.string()) }),
})

const SAFE_ID = /^[\w-]+$/
const failed = (message: string, retryable = false): VideoDirectingFailed => ({ type: 'VideoDirectingFailed', message, retryable })

/**
 * Has the user's Claude Code direct a video from scratch. Claude works as an agent in a
 * workspace made for that video: it writes the animation there, and may run two scripts,
 * which draw its frames for it to look at. It can do nothing else on the machine.
 */
export class ClaudeCodeVideoDirector implements VideoDirector {
  constructor(
    private readonly claude: ClaudePromptRunner,
    private readonly run: ProcessRunner,
    private readonly options: ClaudeCodeVideoDirectorOptions,
  ) {}

  async direct(request: VideoDirectingRequest): Promise<Result<DirectedVideo, VideoDirectingFailed>> {
    const { directory, studio, node, timeoutMs } = this.options
    if (!studio) return err(failed('Le studio vidéo est introuvable. Lancez repo-motion depuis son dossier.'))
    if (!SAFE_ID.test(request.projectId)) return err(failed('Identifiant de projet invalide.'))

    const workspace = join(directory, request.projectId, videoFileName(request.persona.name).replace(/\.mp4$/, ''))
    const scripts = { sheet: join(studio, 'sheet.mjs'), still: join(studio, 'still.mjs') }
    await this.prepare(workspace, studio, scripts, request)

    const question: ClaudeQuestion = {
      prompt: DIRECTOR_PROMPT,
      systemPrompt: DIRECTOR_SYSTEM_PROMPT,
      schema: DIRECTOR_REPORT_SCHEMA,
      tools: 'Read,Write,Edit,Glob,Grep,Bash',
      // The only commands it may run: the two that draw its own frames.
      agent: { commands: [`node ${scripts.sheet}`, `node ${scripts.still}`] },
      cwd: workspace,
      timeoutMs,
      onLine: (line) => {
        const activity = readDirectingActivity(line, workspace)
        if (activity) request.onActivity?.(activity)
      },
    }

    const report = await this.claude.ask(question)
    if (!report.ok) return err(failed(report.error.message, report.error.retryable))

    // The report is Claude's word; the video is checked for itself.
    const first = await this.judge(report.value, request.persona, workspace, node, scripts.sheet)
    if (first.ok) return ok({ piece: first.value, workspace })

    request.onActivity?.('Corrige ce qui ne passe pas')
    const repaired = await this.claude.ask({
      ...question,
      prompt: `You reported the video as finished, but it cannot be used yet:\n\n${first.error}\n\nFix it in this workspace, check it with a sheet, and report again.`,
      timeoutMs: Math.min(timeoutMs, 15 * 60_000),
    })
    if (!repaired.ok) return err(failed(repaired.error.message, repaired.error.retryable))

    const second = await this.judge(repaired.value, request.persona, workspace, node, scripts.sheet)
    return second.ok ? ok({ piece: second.value, workspace }) : err(failed(`La vidéo réalisée par Claude est inutilisable :\n${second.error}`, true))
  }

  async discard(projectId: ProjectId): Promise<void> {
    if (!SAFE_ID.test(projectId)) return
    await rm(join(this.options.directory, projectId), { recursive: true, force: true })
  }

  /** A fresh workspace: the brief, the guide, the product's material, and the smallest video that renders. */
  private async prepare(workspace: string, studio: string, scripts: { sheet: string; still: string }, request: VideoDirectingRequest): Promise<void> {
    const { brief, persona, direction, screens, script } = request
    await rm(workspace, { recursive: true, force: true })
    await mkdir(join(workspace, 'src'), { recursive: true })

    const guide = (await readFile(join(studio, 'GUIDE.md'), 'utf8')).replaceAll('{{SHEET}}', scripts.sheet).replaceAll('{{STILL}}', scripts.still)
    // What the scripts that draw the piece need: the same job the renderer is given.
    const job = {
      projectFolder: request.folder.path,
      product: { name: brief.props.productName },
      brand: { colors: brief.props.brand.colors, fonts: brief.props.brand.fonts, logoPath: brief.props.brand.logoPath ?? null },
      look: direction.props.look,
      screens: screens.map((screen) => screen.file),
    }

    await Promise.all([
      writeFile(join(workspace, 'GUIDE.md'), guide, 'utf8'),
      writeFile(join(workspace, 'BRIEF.md'), directorBrief(brief, persona, direction, screens, script), 'utf8'),
      writeFile(join(workspace, 'job.json'), JSON.stringify(job, null, 2), 'utf8'),
      copyFile(join(studio, 'starter', 'Video.tsx'), join(workspace, 'src', 'Video.tsx')),
    ])
  }

  /** Is the report complete, and does the video really draw? Returns the piece, or what Claude must fix. */
  private async judge(report: unknown, persona: Persona, workspace: string, node: string, sheet: string): Promise<Result<DirectedPiece, string>> {
    const problems: string[] = []

    const parsed = reportSchema.safeParse(report)
    const piece = parsed.success ? DirectedPiece.create(parsed.data, persona) : null
    if (!parsed.success) problems.push('Your final answer must be the report: { concept, shots: [{ label, text, seconds }], post: { caption, hashtags } }.')
    else if (piece && !piece.ok) problems.push(`Your report is not usable:\n${piece.error.violations.join('\n')}`)

    const [code, starter] = await Promise.all([
      readFile(join(workspace, 'src', 'Video.tsx'), 'utf8').catch(() => null),
      readFile(join(this.options.studio ?? '', 'starter', 'Video.tsx'), 'utf8').catch(() => ''),
    ])
    if (code === null) problems.push('src/Video.tsx is missing.')
    else if (code === starter) problems.push('src/Video.tsx is still the starter: the video has not been made.')
    else {
      const drawn = await this.run(node, [sheet], { cwd: workspace, timeoutMs: 5 * 60_000 })
      if (drawn.kind !== 'exited' || drawn.exitCode !== 0) {
        problems.push(drawn.kind === 'exited' ? drawn.stdout.trim().slice(-2500) || 'The video could not be drawn.' : 'The video took too long to draw.')
      }
    }

    if (problems.length > 0 || !piece?.ok) return err(problems.join('\n\n') || 'The report is missing.')
    return ok(piece.value)
  }
}
