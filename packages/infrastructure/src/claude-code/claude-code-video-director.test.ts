import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Personas, ProductBrief, ProjectFolder, ProjectId, Script, VideoDirection } from '@repo-motion/core'
import { aPersonaDraft, aPieceDraft, aProductBriefDraft, aScriptDraft } from '@repo-motion/core/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ClaudeCodeVideoDirector } from './claude-code-video-director'
import { ClaudePromptRunner } from './claude-prompt-runner'
import type { ProcessRunner } from './process-runner'

let root: string
let studio: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'repo-motion-director-'))
  studio = join(root, 'video', 'studio')
  await mkdir(join(studio, 'starter'), { recursive: true })
  await writeFile(join(studio, 'GUIDE.md'), 'Look at your frames: `node {{SHEET}}`, or one of them: `node {{STILL}} 4.2`.')
  await writeFile(join(studio, 'starter', 'Video.tsx'), 'export const DURATION_SECONDS = 20 // starter')
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const brief = (() => {
  const created = ProductBrief.create(aProductBriefDraft())
  if (!created.ok) throw new Error('fixture')
  return created.value
})()
const persona = (() => {
  const created = Personas.create([aPersonaDraft(), aPersonaDraft({ name: 'Marc' })], brief)
  const first = created.ok ? created.value.all[0] : undefined
  if (!first) throw new Error('fixture')
  return first
})()
const folder = (() => {
  const parsed = ProjectFolder.of('/home/ada/app')
  if (!parsed.ok) throw new Error('fixture')
  return parsed.value
})()

const report = (structured: unknown) =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '', structured_output: structured })
const toolUse = (name: string, input: Record<string, unknown>) =>
  JSON.stringify({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', name, input }] } })

interface Turn {
  /** What Claude does in its workspace during that run. */
  work?: (workspace: string) => Promise<void>
  /** Lines Claude prints before its report. */
  lines?: string[]
  report?: unknown
}

/**
 * A scripted Claude Code and a scripted sheet: each run of `claude` plays the next turn,
 * and each run of the sheet script answers with the next entry of `sheets` (true: it draws).
 */
const scripted = (turns: Turn[], sheets: (true | string)[] = [true]) => {
  const claude: { args: readonly string[]; cwd: string | undefined }[] = []
  const drawn: string[] = []
  const run: ProcessRunner = async (command, args, options) => {
    if (command !== 'claude') {
      drawn.push(`${command} ${args.join(' ')}`)
      const result = sheets.shift() ?? true
      return { kind: 'exited', exitCode: result === true ? 0 : 1, stdout: result === true ? 'Sheet written.' : result, stderr: '' }
    }
    claude.push({ args, cwd: options.cwd })
    const turn = turns.shift() ?? {}
    await turn.work?.(options.cwd ?? '')
    const lines = [...(turn.lines ?? []), report(turn.report ?? aPieceDraft())]
    for (const line of lines) options.onLine?.(line)
    return { kind: 'exited', exitCode: 0, stdout: lines.join('\n'), stderr: '' }
  }
  return { run, claude, drawn }
}

const made = async (workspace: string) => writeFile(join(workspace, 'src', 'Video.tsx'), 'export const DURATION_SECONDS = 18 // the real thing')

const directorWith = (run: ProcessRunner, studioFolder: string | null = studio) =>
  new ClaudeCodeVideoDirector(new ClaudePromptRunner(run, { binary: async () => 'claude' }), run, {
    directory: join(root, 'studio'),
    studio: studioFolder,
    node: '/usr/bin/node',
    timeoutMs: 45 * 60_000,
  })

const direction = VideoDirection.restore({ ...VideoDirection.default().props, look: 'collage', tone: 'funny', sound: 'beat' })
const screens = [{ address: 'http://localhost:5173/', title: 'Wiki Géo', shows: 'Le défi du jour', file: '/captures/p1/screen-1.jpg' }]
const script = (() => {
  const created = Script.create(aScriptDraft(), brief)
  if (!created.ok) throw new Error('fixture')
  return created.value
})()
const request = { projectId: ProjectId('p1'), brief, persona, script, folder, direction, screens }
const argument = (args: readonly string[], flag: string) => args[args.indexOf(flag) + 1]

describe('ClaudeCodeVideoDirector', () => {
  it('gives Claude a workspace with the brief, the guide, the product’s material and a first draft', async () => {
    const { run, claude } = scripted([{ work: made }])

    const directed = await directorWith(run).direct(request)

    const workspace = claude[0]?.cwd ?? ''
    expect(directed.ok && directed.value.workspace).toBe(workspace)
    expect(workspace).toMatch(new RegExp(`^${join(root, 'studio', 'p1')}/lea-[0-9a-f]{6}$`))

    const briefing = await readFile(join(workspace, 'BRIEF.md'), 'utf8')
    expect(briefing).toContain('**Léa**, Lycéenne en terminale.')
    expect(briefing).toContain('A whimsical hand-made collage')
    expect(briefing).toContain('Tone: funny.')
    expect(briefing).toContain('1. "Wiki Géo": Le défi du jour')
    expect(briefing).toContain('"music": "beat"')
    // The script the user chose, beat by beat: the words are fixed, the director makes them seen.
    expect(briefing).toContain('The hook opens a question that the "payoff" beat answers: Où est cette ville ?')
    expect(briefing).toContain('| 2 | context | 2.5–5.5 s | « Une page Wikipédia, le *nom caché*. À toi de trouver. » | Les indices de la page se surlignent |')

    // The guide names the two commands by where they really are.
    expect(await readFile(join(workspace, 'GUIDE.md'), 'utf8')).toContain(`node ${join(studio, 'sheet.mjs')}`)
    expect(JSON.parse(await readFile(join(workspace, 'job.json'), 'utf8'))).toMatchObject({
      projectFolder: '/home/ada/app',
      look: 'collage',
      screens: ['/captures/p1/screen-1.jpg'],
    })
  })

  it('lets Claude write in its workspace and draw its own frames, and nothing else', async () => {
    const { run, claude } = scripted([{ work: made }])
    await directorWith(run).direct(request)
    const args = claude[0]?.args ?? []

    expect(argument(args, '--tools')).toBe('Read,Write,Edit,Glob,Grep,Bash')
    expect(argument(args, '--permission-mode')).toBe('acceptEdits')
    const allowed = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--allowedTools') + 3)
    expect(allowed).toEqual([`Bash(node ${join(studio, 'sheet.mjs')}:*)`, `Bash(node ${join(studio, 'still.mjs')}:*)`])
    expect(args).toEqual(expect.arrayContaining(['--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence']))
    expect(args).not.toContain('bypassPermissions')
  })

  it('returns the piece Claude reports, once the video really draws', async () => {
    const { run, drawn } = scripted([{ work: made }])

    const directed = await directorWith(run).direct(request)

    expect(directed.ok && directed.value.piece.props).toMatchObject({ persona: 'Léa', shots: aPieceDraft().shots })
    // Checked by drawing it, not by taking Claude's word for it.
    expect(drawn).toEqual([`/usr/bin/node ${join(studio, 'sheet.mjs')}`])
  })

  it('says what Claude is doing as it works', async () => {
    const seen: string[] = []
    const { run } = scripted([
      {
        work: made,
        lines: [
          toolUse('Read', { file_path: 'BRIEF.md' }),
          toolUse('Write', { file_path: 'NOTES.md' }),
          toolUse('Write', { file_path: 'src/Video.tsx' }),
          toolUse('Bash', { command: `node ${join(studio, 'sheet.mjs')} 3 6` }),
          toolUse('Read', { file_path: 'review/sheet-3-6.png' }),
          toolUse('Write', { file_path: 'sound.json' }),
        ],
      },
    ])

    await directorWith(run).direct({ ...request, onActivity: (activity) => seen.push(activity) })

    expect(seen).toEqual([
      'Lit le brief',
      'Écrit le concept et le découpage',
      'Écrit src/Video.tsx',
      'Tire une planche de ses images',
      'Regarde ses images et les critique',
      'Compose la bande-son',
    ])
  })

  it('sends Claude back to work when the video does not draw, with what is wrong', async () => {
    const { run, claude } = scripted([{ work: made }, { work: made }], ['The piece could not be drawn:\nsrc/Video.tsx:12:4: ERROR: Unexpected "}"', true])

    const directed = await directorWith(run).direct(request)

    expect(directed.ok).toBe(true)
    expect(argument(claude[1]?.args ?? [], '-p')).toContain('src/Video.tsx:12:4: ERROR: Unexpected "}"')
  })

  it('does not accept a report without a video, or a report that is not one', async () => {
    const untouched = scripted([{}, { work: made }])
    await directorWith(untouched.run).direct(request)
    expect(argument(untouched.claude[1]?.args ?? [], '-p')).toContain('still the starter')

    const tooShort = scripted([{ work: made, report: aPieceDraft({ shots: aPieceDraft().shots.slice(0, 1) }) }, { work: made }])
    await directorWith(tooShort.run).direct(request)
    expect(argument(tooShort.claude[1]?.args ?? [], '-p')).toContain('Il faut entre 3 et 16 plans')
  })

  it('gives up when the video still does not draw after a second try', async () => {
    const { run } = scripted([{ work: made }, { work: made }], ['Boom', 'Boom again'])

    const directed = await directorWith(run).direct(request)

    expect(directed.ok ? null : directed.error).toMatchObject({ type: 'VideoDirectingFailed', message: expect.stringContaining('Boom again') })
  })

  it('does not start without its studio, and forgets a project’s workspaces with it', async () => {
    const { run, claude } = scripted([])
    const missing = await directorWith(run, null).direct(request)
    expect(missing.ok ? null : missing.error.type).toBe('VideoDirectingFailed')
    expect(claude).toEqual([])

    await mkdir(join(root, 'studio', 'p1', 'lea'), { recursive: true })
    await mkdir(join(root, 'studio', 'p2'), { recursive: true })
    await directorWith(run).discard(ProjectId('p1'))
    await directorWith(run).discard(ProjectId('../studio'))

    expect(existsSync(join(root, 'studio', 'p1'))).toBe(false)
    expect(existsSync(join(root, 'studio', 'p2'))).toBe(true)
  })
})
