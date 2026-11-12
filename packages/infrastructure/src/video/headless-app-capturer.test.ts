import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProjectId } from '@repo-motion/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProcessOutcome, ProcessRunner } from '../claude-code/process-runner'
import { HeadlessAppCapturer } from './headless-app-capturer'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'repo-motion-captures-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

/** A capture script that prints `lines`, and remembers the job it was given. */
const scripted = (lines: object[] | ProcessOutcome) => {
  const jobs: Record<string, unknown>[] = []
  const run: ProcessRunner = async (_, args, options) => {
    jobs.push(JSON.parse(await readFile(args[1] ?? '', 'utf8')))
    if (!Array.isArray(lines)) return lines
    for (const line of lines) options.onLine?.(JSON.stringify(line))
    return { kind: 'exited', exitCode: 0, stdout: '', stderr: '' }
  }
  return { run, jobs }
}

const capturerWith = (run: ProcessRunner, script: string | null = '/repo/packages/video/capture.mjs') =>
  new HeadlessAppCapturer(run, { directory: join(root, 'captures'), script, node: '/usr/bin/node', timeoutMs: 60_000 })

const request = { projectId: ProjectId('p1'), persona: 'Léa', take: 'pages' as const, addresses: ['http://localhost:5173', 'http://localhost:5173/defi'], lenient: false, language: 'fr' }
const screen = (index: number) => ({ address: request.addresses[index], title: `Page ${index + 1}`, file: `/captures/p1/screen-${index + 1}.jpg`, height: 844 })

describe('HeadlessAppCapturer', () => {
  it('has each page photographed into the project’s folder, in order', async () => {
    const { run, jobs } = scripted([{ screen: screen(0) }, { screen: screen(1) }, { done: true }])

    const screens = await capturerWith(run).capture(request)

    // Léa's pictures, for this take: another video filmed at the same time has its own.
    expect(jobs[0]).toMatchObject({ addresses: request.addresses, lenient: false, language: 'fr' })
    expect(String(jobs[0]?.output)).toMatch(new RegExp(`^${join(root, 'captures', 'p1')}/lea-[0-9a-f]{6}/pages$`))
    expect(screens.ok && screens.value.map((captured) => captured.title)).toEqual(['Page 1', 'Page 2'])
  })

  it('passes on why the application could not be filmed', async () => {
    const screens = await capturerWith(scripted([{ error: "L'application ne répond pas à http://localhost:5173." }]).run).capture(request)
    expect(screens.ok ? null : screens.error).toEqual({ type: 'AppCaptureFailed', message: "L'application ne répond pas à http://localhost:5173." })
  })

  it('fails when the script stops without having finished', async () => {
    const screens = await capturerWith(scripted([{ screen: screen(0) }]).run).capture(request)
    expect(screens.ok ? null : screens.error.type).toBe('AppCaptureFailed')
  })

  it('gives up on a capture that takes too long, or that cannot be started', async () => {
    const slow = await capturerWith(scripted({ kind: 'timed_out' }).run).capture(request)
    const noScript = await capturerWith(scripted([]).run, null).capture(request)

    expect(slow.ok ? null : slow.error.message).toContain('trop de temps')
    expect(noScript.ok ? null : noScript.error.message).toContain('introuvable')
  })
})
