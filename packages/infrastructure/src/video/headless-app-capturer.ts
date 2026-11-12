import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppCapturer, AppCaptureFailed, AppCaptureRequest, CapturedScreen, Result } from '@repo-motion/core'
import type { ProjectId } from '@repo-motion/core'
import { err, ok } from '@repo-motion/core'
import { z } from 'zod'
import type { ProcessRunner } from '../claude-code/process-runner'
import { videoFileName } from './remotion-video-renderer'
import { lastErrorLine, runVideoScript } from './video-scripts'

export interface HeadlessAppCapturerOptions {
  /** Where the pictures are kept: one folder per project. */
  readonly directory: string
  /** The script of the video package that photographs pages; `null` when it could not be found. */
  readonly script: string | null
  readonly node: string
  readonly timeoutMs: number
}

const messageSchema = z.union([
  z.object({ screen: z.object({ address: z.string(), title: z.string(), file: z.string() }) }),
  z.object({ done: z.literal(true) }),
  z.object({ error: z.string() }),
])

const SAFE_ID = /^[\w-]+$/
const failed = (message: string): AppCaptureFailed => ({ type: 'AppCaptureFailed', message })

/** Photographs the running application with a headless browser set up like a phone. */
export class HeadlessAppCapturer implements AppCapturer {
  constructor(
    private readonly run: ProcessRunner,
    private readonly options: HeadlessAppCapturerOptions,
  ) {}

  async capture(request: AppCaptureRequest): Promise<Result<CapturedScreen[], AppCaptureFailed>> {
    const { directory, script, node, timeoutMs } = this.options
    if (!script) return err(failed('Le moteur de capture est introuvable. Lancez repo-motion depuis son dossier.'))
    if (!SAFE_ID.test(request.projectId)) return err(failed('Identifiant de projet invalide.'))

    // One folder per video and per take: two videos filmed at once never share a picture.
    const output = join(directory, request.projectId, videoFileName(request.persona).replace(/\.mp4$/, ''), request.take)
    const screens: CapturedScreen[] = []
    let done = false
    let error: string | null = null

    const outcome = await runVideoScript(this.run, {
      node,
      script,
      jobFile: join(output, 'capture.job.json'),
      job: { output, addresses: request.addresses, lenient: request.lenient, language: request.language },
      timeoutMs,
      onMessage: (message) => {
        const parsed = messageSchema.safeParse(message)
        if (!parsed.success) return
        if ('screen' in parsed.data) screens.push(parsed.data.screen)
        else if ('done' in parsed.data) done = true
        else error = parsed.data.error
      },
    })

    if (outcome.kind === 'not_found') return err(failed("Node est introuvable pour lancer la capture de l'application."))
    if (outcome.kind === 'timed_out') return err(failed("La capture de l'application a pris trop de temps et a été interrompue."))
    if (error) return err(failed(error))
    if (!done || screens.length === 0) return err(failed(`La capture de l'application a échoué${lastErrorLine(outcome.stderr)}`))
    return ok(screens)
  }

  async discard(projectId: ProjectId): Promise<void> {
    if (!SAFE_ID.test(projectId)) return
    await rm(join(this.options.directory, projectId), { recursive: true, force: true })
  }
}
