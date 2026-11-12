import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Personas, ProductBrief, ProjectFolder, ProjectId, Storyboard, VideoDirection } from '@repo-motion/core'
import { aPersonaDraft, aProductBriefDraft, aStoryboardDraft } from '@repo-motion/core/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProcessOutcome, ProcessRunner } from '../claude-code/process-runner'
import { RemotionVideoRenderer, videoFileName } from './remotion-video-renderer'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'repo-motion-videos-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const brief = (() => {
  const created = ProductBrief.create(aProductBriefDraft())
  if (!created.ok) throw new Error('fixture')
  return created.value
})()

const storyboard = (() => {
  const personas = Personas.create([aPersonaDraft(), aPersonaDraft({ name: 'Marc' })], brief)
  const lea = personas.ok ? personas.value.all[0] : undefined
  const created = lea ? Storyboard.create(aStoryboardDraft(), lea, brief) : null
  if (!created?.ok) throw new Error('fixture')
  return created.value
})()

const folder = (() => {
  const parsed = ProjectFolder.of('/home/ada/app')
  if (!parsed.ok) throw new Error('fixture')
  return parsed.value
})()

/** A render script that prints `lines`, and remembers what it was started with. */
const scripted = (lines: object[] | ProcessOutcome, stderr = '') => {
  const calls: { command: string; args: readonly string[]; job: Record<string, unknown> }[] = []
  const run: ProcessRunner = async (command, args, options) => {
    // The job file only exists while the script runs.
    calls.push({ command, args, job: JSON.parse(await readFile(args[1] ?? '', 'utf8')) })
    if (!Array.isArray(lines)) return lines
    for (const line of lines) options.onLine?.(JSON.stringify(line))
    return { kind: 'exited', exitCode: lines.some((line) => 'done' in line) ? 0 : 1, stdout: '', stderr }
  }
  return { run, calls }
}

const rendererWith = (run: ProcessRunner, script: string | null = '/repo/packages/video/render.mjs') =>
  new RemotionVideoRenderer(run, { directory: join(root, 'videos'), script, node: '/usr/bin/node', timeoutMs: 120_000 })

const quick = VideoDirection.restore({ ...VideoDirection.default().props, production: 'template' })
const request = { projectId: ProjectId('p1'), folder, brief, persona: 'Léa', source: { kind: 'storyboard' as const, storyboard }, direction: quick, screens: [] }

describe('RemotionVideoRenderer', () => {
  it('hands the render script everything it needs, and returns where the video is', async () => {
    const output = join(root, 'videos', 'p1', videoFileName('Léa'))
    const { run, calls } = scripted([{ progress: 0.5 }, { done: true, file: output, seconds: 19.2 }])

    const video = await rendererWith(run).render(request)

    expect(video.ok && video.value).toEqual({ file: output, seconds: 19.2 })
    expect(calls[0]?.command).toBe('/usr/bin/node')
    expect(calls[0]?.args[0]).toBe('/repo/packages/video/render.mjs')
    expect(calls[0]?.job).toMatchObject({
      output,
      projectFolder: '/home/ada/app',
      product: { name: 'Wiki Géo' },
      brand: { colors: { primary: '#1e40af' }, fonts: ['Inter'], logoPath: 'public/logo.svg' },
      look: 'brand',
      sound: { kind: 'none', track: null },
      screens: [],
    })
    // Each shot comes with how long it lasts: the script does not decide the pacing.
    expect((calls[0]?.job.scenes as { kind: string; seconds: number }[])[0]).toMatchObject({ kind: 'hook', seconds: 3.86 })
    expect(existsSync(calls[0]?.args[1] ?? '')).toBe(false)
  })

  it('passes on how the video should look and sound, and the pictures of the application', async () => {
    const direction = VideoDirection.restore({
      look: 'impact',
      tone: 'pushy',
      sound: 'track',
      track: '/home/ada/Music/beat.mp3',
      demo: { mode: 'pages', addresses: ['http://localhost:5173'] },
      production: 'template',
    })
    const { run, calls } = scripted([{ done: true, file: '/x.mp4', seconds: 12 }])

    await rendererWith(run).render({
      ...request,
      direction,
      screens: [{ address: 'http://localhost:5173', title: 'Accueil', shows: null, file: '/captures/p1/screen-1.jpg' }],
    })

    expect(calls[0]?.job).toMatchObject({
      look: 'impact',
      sound: { kind: 'track', track: '/home/ada/Music/beat.mp3' },
      screens: ['/captures/p1/screen-1.jpg'],
    })
  })

  it('renders a video Claude directed from the workspace it was written in', async () => {
    const { run, calls } = scripted([{ done: true, file: '/x.mp4', seconds: 24 }])

    const video = await rendererWith(run).render({ ...request, source: { kind: 'piece', workspace: '/studio/p1/lea' }, direction: VideoDirection.default() })

    expect(video.ok && video.value.seconds).toBe(24)
    expect(calls[0]?.job).toMatchObject({ directed: { workspace: '/studio/p1/lea' }, product: { name: 'Wiki Géo' } })
    // There are no ready-made shots to assemble: the piece is its own code.
    expect(calls[0]?.job.scenes).toBeUndefined()
  })

  it('reports progress as frames are rendered, ignoring anything else the script prints', async () => {
    const { run } = scripted([{ progress: 0.2 }, { note: 'bundling' }, { progress: 0.9 }, { done: true, file: '/x.mp4', seconds: 12 }])
    const seen: number[] = []

    await rendererWith(run).render({ ...request, onProgress: (progress) => seen.push(progress) })

    expect(seen).toEqual([0.2, 0.9])
  })

  it('returns the reason the script gave when it fails', async () => {
    const video = await rendererWith(scripted([{ error: 'Chrome could not start' }]).run).render(request)
    expect(video.ok ? null : video.error).toMatchObject({ type: 'VideoRenderingFailed', message: 'Chrome could not start' })
  })

  it('falls back to what the script wrote on its error output', async () => {
    const video = await rendererWith(scripted([], 'warning\nError: out of memory\n').run).render(request)
    expect(video.ok ? null : video.error.message).toBe('Le rendu vidéo a échoué : Error: out of memory')
  })

  it('says so when the render takes too long', async () => {
    const video = await rendererWith(scripted({ kind: 'timed_out' }).run).render(request)
    expect(video.ok ? null : video.error.message).toBe('Le rendu a dépassé 2 minutes et a été interrompu.')
  })

  it('does not run anything when the render script was not found', async () => {
    const { run, calls } = scripted([])
    const video = await rendererWith(run, null).render(request)

    expect(video.ok ? null : video.error.type).toBe('VideoRenderingFailed')
    expect(calls).toEqual([])
  })

  it('deletes a project’s videos, and nothing outside its own folder', async () => {
    const videos = join(root, 'videos')
    await mkdir(join(videos, 'p1'), { recursive: true })
    await mkdir(join(videos, 'p2'), { recursive: true })
    await writeFile(join(videos, 'p1', 'lea.mp4'), 'video')
    const renderer = rendererWith(scripted([]).run)

    await renderer.discard(ProjectId('p1'))
    await renderer.discard(ProjectId('../videos'))

    expect(existsSync(join(videos, 'p1'))).toBe(false)
    expect(existsSync(join(videos, 'p2'))).toBe(true)
  })

  it('names files after the persona, without colliding on accents', () => {
    expect(videoFileName('Léa')).toMatch(/^lea-[0-9a-f]{6}\.mp4$/)
    expect(videoFileName('Léa')).not.toBe(videoFileName('Lea'))
    expect(videoFileName('../../etc')).toMatch(/^etc-[0-9a-f]{6}\.mp4$/)
    expect(videoFileName('日本')).toMatch(/^persona-[0-9a-f]{6}\.mp4$/)
  })
})
