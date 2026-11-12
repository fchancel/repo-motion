import { createHash } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProjectId, RenderedVideo, Result, VideoRenderer, VideoRenderingFailed, VideoRenderRequest } from '@repo-motion/core'
import { err, ok, sceneSeconds } from '@repo-motion/core'
import { z } from 'zod'
import type { ProcessRunner } from '../claude-code/process-runner'
import { lastErrorLine, runVideoScript } from './video-scripts'

export interface RemotionVideoRendererOptions {
  /** Where the videos are kept: one folder per project. */
  readonly directory: string
  /** The script of the video package that renders one job; `null` when it could not be found. */
  readonly script: string | null
  /** The Node executable that runs it. */
  readonly node: string
  readonly timeoutMs: number
}

/** What the render script prints, one JSON object per line. */
const lineSchema = z.union([
  z.object({ progress: z.number().min(0).max(1) }),
  z.object({ done: z.literal(true), file: z.string(), seconds: z.number().positive() }),
  z.object({ error: z.string() }),
])

const SAFE_ID = /^[\w-]+$/
const failed = (message: string): VideoRenderingFailed => ({ type: 'VideoRenderingFailed', message })

/** A file name made from the persona's name, unique even when two names differ only by accents. */
export const videoFileName = (persona: string): string => {
  const slug = persona
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
    .slice(0, 40)
  const hash = createHash('sha1').update(persona).digest('hex').slice(0, 6)
  return `${slug || 'persona'}-${hash}.mp4`
}

/**
 * Renders with Remotion, in a separate Node process: the video package (React, a bundler,
 * a headless browser) stays out of the application's own server.
 */
export class RemotionVideoRenderer implements VideoRenderer {
  constructor(
    private readonly run: ProcessRunner,
    private readonly options: RemotionVideoRendererOptions,
  ) {}

  async render(request: VideoRenderRequest): Promise<Result<RenderedVideo, VideoRenderingFailed>> {
    const { directory, script, node, timeoutMs } = this.options
    if (!script) return err(failed('Le moteur de rendu vidéo est introuvable. Lancez repo-motion depuis son dossier.'))
    if (!SAFE_ID.test(request.projectId)) return err(failed('Identifiant de projet invalide.'))

    const { brief, source, direction } = request
    const output = join(directory, request.projectId, videoFileName(request.persona))

    // The contract with the render script: everything it needs, and nothing it must work out.
    const job = {
      output,
      projectFolder: request.folder.path,
      product: { name: brief.props.productName, tagline: brief.props.tagline },
      brand: { colors: brief.props.brand.colors, fonts: brief.props.brand.fonts, logoPath: brief.props.brand.logoPath ?? null },
      look: direction.props.look,
      sound: { kind: direction.props.sound, track: direction.props.track },
      // The pictures of the application, in the order they were taken.
      screens: request.screens.map((screen) => screen.file),
      // Either the shots to assemble, each with how long it lasts, or where the piece Claude directed is.
      ...(source.kind === 'storyboard'
        ? { scenes: source.storyboard.props.scenes.map((scene) => ({ ...scene, seconds: sceneSeconds(scene) })) }
        : { directed: { workspace: source.workspace } }),
    }

    let result: Result<RenderedVideo, VideoRenderingFailed> | null = null
    const outcome = await runVideoScript(this.run, {
      node,
      script,
      jobFile: `${output}.job.json`,
      job,
      timeoutMs,
      onMessage: (message) => {
        const parsed = lineSchema.safeParse(message)
        if (!parsed.success) return
        if ('progress' in parsed.data) request.onProgress?.(parsed.data.progress)
        else if ('done' in parsed.data) result = ok({ file: parsed.data.file, seconds: parsed.data.seconds })
        else result = err(failed(parsed.data.error))
      },
    })

    if (outcome.kind === 'not_found') return err(failed('Node est introuvable pour lancer le rendu vidéo.'))
    if (outcome.kind === 'timed_out') {
      return err(failed(`Le rendu a dépassé ${Math.round(timeoutMs / 60_000)} minutes et a été interrompu.`))
    }
    return result ?? err(failed(`Le rendu vidéo a échoué${lastErrorLine(outcome.stderr)}`))
  }

  async discard(projectId: ProjectId): Promise<void> {
    if (!SAFE_ID.test(projectId)) return
    await rm(join(this.options.directory, projectId), { recursive: true, force: true })
  }
}
