import { Personas, ProductBrief, ProjectFolder, Script, TONES, VideoDirection, type VideoDirectionProps } from '@repo-motion/core'
import { aPersonaDraft, aProductBriefDraft, aScriptDraft } from '@repo-motion/core/testing'
import { describe, expect, it } from 'vitest'
import { ClaudeBinaryLocator } from './claude-binary-locator'
import { ClaudeCodeCli } from './claude-code-cli'
import { ClaudeCodeCodebaseAnalyzer } from './claude-code-codebase-analyzer'
import { ClaudeCodeDemoScout } from './claude-code-demo-scout'
import { ClaudeCodePersonaWriter } from './claude-code-persona-writer'
import { ClaudeCodeScriptWriter } from './claude-code-script-writer'
import { ClaudeCodeStoryboardWriter } from './claude-code-storyboard-writer'
import { ClaudeCodeStyleAdvisor } from './claude-code-style-advisor'
import { ClaudePromptRunner } from './claude-prompt-runner'
import type { ProcessOutcome, ProcessRunner } from './process-runner'

/** Lines in the format `claude -p --output-format stream-json` prints. */
const toolUse = (name: string, input: Record<string, unknown>) =>
  JSON.stringify({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', name, input }] } })

const success = (structured: unknown) =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '', structured_output: structured })

const failure = (text: string, subtype = 'success') =>
  JSON.stringify({ type: 'result', subtype, is_error: true, result: text })

/** A scripted Claude Code: each run prints the next list of lines, then exits. */
const scripted = (...runs: (string[] | ProcessOutcome)[]) => {
  const calls: { command: string; args: readonly string[]; cwd: string | undefined }[] = []
  const run: ProcessRunner = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd })
    const next = runs.shift() ?? []
    if (!Array.isArray(next)) return next
    for (const line of next) options.onLine?.(line)
    return { kind: 'exited', exitCode: 0, stdout: next.join('\n'), stderr: '' }
  }
  return { run, calls }
}

const folder = (() => {
  const parsed = ProjectFolder.of('/home/ada/app')
  if (!parsed.ok) throw new Error('fixture')
  return parsed.value
})()

const claudeWith = (run: ProcessRunner, binary: string | null = 'claude') => new ClaudePromptRunner(run, { binary: async () => binary })
const analyzerWith = (run: ProcessRunner) => new ClaudeCodeCodebaseAnalyzer(claudeWith(run), { timeoutMs: 60_000 })

const argument = (args: readonly string[], flag: string) => args[args.indexOf(flag) + 1]

describe('ClaudeCodeCodebaseAnalyzer', () => {
  it('runs Claude Code in the folder and returns the brief', async () => {
    const { run, calls } = scripted([success(aProductBriefDraft())])

    const brief = await analyzerWith(run).analyze({ folder })

    expect(brief.ok && brief.value.props.productName).toBe('Wiki Géo')
    expect(calls[0]?.cwd).toBe('/home/ada/app')
  })

  it('only lets Claude read, and keeps the run hermetic', async () => {
    const { run, calls } = scripted([success(aProductBriefDraft())])
    await analyzerWith(run).analyze({ folder })
    const args = calls[0]?.args ?? []

    expect(argument(args, '--tools')).toBe('Read,Glob,Grep')
    expect(argument(args, '--permission-mode')).toBe('dontAsk')
    expect(argument(args, '--setting-sources')).toBe('user')
    expect(args).toEqual(expect.arrayContaining(['--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence']))
    // `--bare` would ignore the user's subscription sign-in.
    expect(args).not.toContain('--bare')
  })

  it('reports what Claude is doing, with paths relative to the folder', async () => {
    const { run } = scripted([
      toolUse('Read', { file_path: '/home/ada/app/src/pages/index.vue' }),
      toolUse('Glob', { pattern: '**/*.css' }),
      toolUse('Grep', { pattern: 'primary' }),
      success(aProductBriefDraft()),
    ])
    const seen: string[] = []

    await analyzerWith(run).analyze({ folder, onActivity: (activity) => seen.push(activity) })

    expect(seen).toEqual([
      'Lecture de src/pages/index.vue',
      'Recherche de fichiers : **/*.css',
      'Recherche de « primary » dans le code',
    ])
  })

  it('reads a brief given as text when there is no structured output', async () => {
    const answer = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: `\`\`\`json\n${JSON.stringify(aProductBriefDraft())}\n\`\`\`` })
    const brief = await analyzerWith(scripted([answer]).run).analyze({ folder })

    expect(brief.ok).toBe(true)
  })

  it('asks Claude to fix a brief the domain rejects, without tools', async () => {
    const draft = aProductBriefDraft()
    const noCoreFeature = { ...draft, features: draft.features.map((feature) => ({ ...feature, importance: 'secondary' })) }
    const { run, calls } = scripted([success(noCoreFeature)], [success(draft)])

    const brief = await analyzerWith(run).analyze({ folder })

    expect(brief.ok).toBe(true)
    expect(calls).toHaveLength(2)
    expect(argument(calls[1]?.args ?? [], '--tools')).toBe('')
    expect(argument(calls[1]?.args ?? [], '-p')).toContain('Au moins une feature doit être marquée "core".')
  })

  it('says so when Claude Code is not installed, without running anything', async () => {
    const { run, calls } = scripted()
    const brief = await new ClaudeCodeCodebaseAnalyzer(claudeWith(run, null), { timeoutMs: 60_000 }).analyze({ folder })

    expect(brief.ok ? null : brief.error.message).toContain("n'est pas installé")
    expect(calls).toEqual([])
  })

  it('gives up when the fixed brief is still wrong', async () => {
    const broken = { ...aProductBriefDraft(), audiences: [] }
    const brief = await analyzerWith(scripted([success(broken)], [success(broken)]).run).analyze({ folder })

    expect(brief.ok ? null : brief.error.message).toContain('audiences')
  })

  it.each([
    [{ kind: 'not_found' } as ProcessOutcome, "n'est pas installé", false],
    [{ kind: 'timed_out' } as ProcessOutcome, 'dépassé 1 minutes', true],
    [[failure('Not logged in · Please run /login')], 'claude auth login', false],
    [[failure('Claude usage limit reached. Your limit will reset at 7pm.')], 'limite', true],
    [[failure('', 'error_max_turns')], 'trop long', true],
    [{ kind: 'exited', exitCode: 1, stdout: '', stderr: 'boom\nfatal: crash' } as ProcessOutcome, 'fatal: crash', true],
  ])('explains failure %#', async (outcome, message, retryable) => {
    const brief = await analyzerWith(scripted(outcome).run).analyze({ folder })

    expect(brief.ok ? null : brief.error.message).toContain(message)
    expect(brief.ok ? null : brief.error.retryable).toBe(retryable)
  })
})

describe('ClaudeCodePersonaWriter', () => {
  const brief = (() => {
    const created = ProductBrief.create(aProductBriefDraft())
    if (!created.ok) throw new Error('fixture')
    return created.value
  })()
  const twoPersonas = { personas: [aPersonaDraft(), aPersonaDraft({ name: 'Marc', audience: 'Amateurs de quiz' })] }

  it('writes personas from the brief alone, with no tool at all', async () => {
    const { run, calls } = scripted([success(twoPersonas)])

    const personas = await new ClaudeCodePersonaWriter(claudeWith(run)).write({ brief, folder })

    expect(personas.ok && personas.value.all.map((persona) => persona.name)).toEqual(['Léa', 'Marc'])
    expect(argument(calls[0]?.args ?? [], '--tools')).toBe('')
    expect(argument(calls[0]?.args ?? [], '-p')).toContain('"productName": "Wiki Géo"')
    expect(argument(calls[0]?.args ?? [], '-p')).toContain('"rationale"')
  })

  it('has Claude fix personas that mention a feature the product does not have', async () => {
    const invented = { personas: [aPersonaDraft(), aPersonaDraft({ name: 'Marc', keyFeatures: ['Mode multijoueur'] })] }
    const { run, calls } = scripted([success(invented)], [success(twoPersonas)])

    const personas = await new ClaudeCodePersonaWriter(claudeWith(run)).write({ brief, folder })

    expect(personas.ok).toBe(true)
    expect(argument(calls[1]?.args ?? [], '-p')).toContain("n'est pas une fonctionnalité du brief")
  })

  it('reports a failure as a persona failure', async () => {
    const personas = await new ClaudeCodePersonaWriter(claudeWith(scripted({ kind: 'timed_out' }).run)).write({ brief, folder })
    expect(personas.ok ? null : personas.error.type).toBe('PersonaWritingFailed')
  })
})

describe('ClaudeCodeStoryboardWriter', () => {
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

  /** What Claude is asked for: the fixed structure of a short video, not a list of scenes. */
  const answer = (overrides: Record<string, unknown> = {}) => ({
    hook: 'Tu révises la géo et tu *décroches* ?',
    pain: ['Les fiches *t’endorment*.', 'Les cartes ne rentrent pas.'],
    reveal: 'La géo qui se joue, *lien après lien*.',
    features: [
      {
        feature: 'Défi du jour',
        icon: 'calendar',
        visual: { type: 'checklist', items: ['Lieu 1', 'Lieu 2', 'Lieu 3'] },
        title: 'Un *défi* par jour',
        caption: 'Le même parcours pour toute ta classe.',
      },
    ],
    benefit: 'Tu révises *sans t’en rendre compte*.',
    cta: 'Joue le défi du jour',
    post: { caption: 'Réviser la géo sans ouvrir une fiche.', hashtags: ['#bac', '#geographie', '#revision'] },
    ...overrides,
  })

  const directed = (choices: Partial<VideoDirectionProps> = {}) => VideoDirection.restore({ ...VideoDirection.default().props, ...choices })
  const screens = [{ address: 'http://localhost:5173/defi', title: 'Défi du jour', shows: 'Les 5 lieux du jour', file: '/captures/p1/screen-1.jpg' }]

  const script = (() => {
    const created = Script.create(aScriptDraft(), brief)
    if (!created.ok) throw new Error('fixture')
    return created.value
  })()

  const write = (run: ProcessRunner, direction = directed()) =>
    new ClaudeCodeStoryboardWriter(claudeWith(run)).write({ brief, persona, script, folder, direction, screens: direction.showsDemo ? screens : [] })

  it('fits the chosen script into the shots, with no tool at all', async () => {
    const { run, calls } = scripted([success(answer())])

    const storyboard = await write(run)

    expect(storyboard.ok && storyboard.value.props.persona).toBe('Léa')
    expect(storyboard.ok && storyboard.value.props.scenes.map((scene) => scene.kind)).toEqual(['hook', 'pain', 'reveal', 'feature', 'benefit', 'cta'])
    expect(argument(calls[0]?.args ?? [], '--tools')).toBe('')
    const prompt = argument(calls[0]?.args ?? [], '-p')
    expect(prompt).toContain('The video is for Léa')
    expect(prompt).toContain('1. [hook] 0.0 s, 2.5 s — seen: Une page Wikipédia dont le nom est caviardé — read: « Où est cette ville ? Tu as *5 secondes*. »')
    expect(prompt).toContain('Question opened by the hook: Où est cette ville ?')
  })

  it('asks for an interface in motion for each feature, and tells Claude what each one shows', async () => {
    const { run, calls } = scripted([success(answer())])

    const storyboard = await write(run)

    const feature = storyboard.ok ? storyboard.value.props.scenes.find((scene) => scene.kind === 'feature') : null
    expect(feature).toMatchObject({ visual: { type: 'checklist', items: ['Lieu 1', 'Lieu 2', 'Lieu 3'] } })
    expect(argument(calls[0]?.args ?? [], '-p')).toContain('- "counter": a number counts up.')
  })

  it('removes emoji, which the video’s typefaces cannot draw', async () => {
    const storyboard = await write(scripted([success(answer({ cta: 'Joue le défi 🚀' }))]).run)

    expect(storyboard.ok && storyboard.value.props.scenes.at(-1)).toEqual({ kind: 'cta', text: 'Joue le défi' })
  })

  it('has Claude fix a video that shows a feature the product does not have', async () => {
    const invented = answer({
      features: [{ feature: 'Mode hors ligne', icon: 'bolt', visual: { type: 'cards', items: ['Un', 'Deux'] }, title: 'Sans réseau', caption: 'Partout.' }],
    })
    const { run, calls } = scripted([success(invented)], [success(answer())])

    const storyboard = await write(run)

    expect(storyboard.ok).toBe(true)
    const repair = argument(calls[1]?.args ?? [], '-p')
    expect(repair).toContain("n'est pas une fonctionnalité du brief")
    // Claude wrote flat fields: the problems name scenes, so it is told which is which.
    expect(repair).toContain('scenes[3] = feature')
  })

  it('keeps the brand’s voice unless another tone is asked for', async () => {
    const { run, calls } = scripted([success(answer())], [success(answer())])

    await write(run)
    await write(run, directed({ tone: 'pushy' }))

    expect(argument(calls[0]?.args ?? [], '-p')).toContain('Write in the brand voice described in the brief.')
    const pushy = argument(calls[1]?.args ?? [], '-p')
    expect(pushy).toContain('Tone: pushy.')
    // Pressure comes from the wording, never from invented facts.
    expect(pushy).toContain('No invented scarcity')
  })

  it('knows how to write in every tone on offer', async () => {
    for (const tone of TONES.filter((name) => name !== 'brand')) {
      const { run, calls } = scripted([success(answer())])
      await write(run, directed({ tone }))
      expect(argument(calls[0]?.args ?? [], '-p'), tone).toContain('Tone: ')
    }
  })

  it('asks for the demo shot when the application was filmed, and puts it after the reveal', async () => {
    const direction = directed({ demo: { mode: 'pages', addresses: ['http://localhost:5173/defi'] } })
    const { run, calls } = scripted([success(answer({ demo: 'Le vrai *défi du jour*, sur ton écran.' }))])

    const storyboard = await write(run, direction)

    expect(storyboard.ok && storyboard.value.props.scenes.map((scene) => scene.kind)).toEqual(['hook', 'pain', 'reveal', 'demo', 'feature', 'benefit', 'cta'])
    expect(argument(calls[0]?.args ?? [], '-p')).toContain('1. "Défi du jour" (http://localhost:5173/defi), which shows: Les 5 lieux du jour')
    expect(JSON.parse(argument(calls[0]?.args ?? [], '--json-schema') ?? '{}').required).toContain('demo')
  })

  it('ignores a demo shot nobody asked for', async () => {
    const storyboard = await write(scripted([success(answer({ demo: 'Regarde.' }))]).run)

    expect(storyboard.ok && storyboard.value.props.scenes.some((scene) => scene.kind === 'demo')).toBe(false)
  })

  it('reports a failure as a storyboard failure', async () => {
    const storyboard = await write(scripted({ kind: 'timed_out' }).run)
    expect(storyboard.ok ? null : storyboard.error.type).toBe('StoryboardWritingFailed')
  })
})

describe('ClaudeCodeScriptWriter', () => {
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

  const scripts = [aScriptDraft(), aScriptDraft({ format: 'myth', openLoop: null }), aScriptDraft({ format: 'challenge' })]
  const written = (drafts: unknown[] = scripts) => ({
    productInOneSentence: 'Un jeu où l’on devine une ville à partir de sa page Wikipédia.',
    showableMoment: 'La page caviardée, et le repère qui tombe.',
    hooks: [{ format: 'play-along', text: 'Où est cette ville ?' }],
    scripts: drafts,
  })
  const viewer = (overrides: Record<string, unknown> = {}) => ({
    firstImpression: 'Une page Wikipédia ?',
    leftInBeat: null,
    why: 'Je voulais la réponse.',
    understoodInBeat: 2,
    whatItIs: 'Un jeu de géographie avec Wikipédia.',
    whatFor: 'Deviner des villes.',
    confusing: [],
    scores: { hook: 8, clarity: 7, retention: 8 },
    ...overrides,
  })
  const lost = viewer({ leftInBeat: 1, understoodInBeat: null, whatItIs: 'Je ne sais pas.', confusing: ['caviardé'], scores: { hook: 3, clarity: 1, retention: 2 } })
  const revised = (recommended = 0) => ({ scripts, recommended, why: 'Le plus clair.' })

  const write = (run: ProcessRunner, onActivity?: (activity: string) => void) =>
    new ClaudeCodeScriptWriter(claudeWith(run)).write({ brief, persona, folder, direction: VideoDirection.default(), screens: [], ...(onActivity ? { onActivity } : {}) })

  it('writes three scripts, has a viewer watch each one, rewrites them, and has them watched again', async () => {
    const { run, calls } = scripted(
      [success(written())],
      [success(lost)],
      [success(viewer())],
      [success(viewer())],
      [success(revised(1))],
      [success(viewer())],
      [success(viewer())],
      [success(viewer({ understoodInBeat: 1 }))],
    )
    const activity: string[] = []

    const result = await write(run, (step) => activity.push(step))

    expect(calls).toHaveLength(8)
    expect(calls.every((call) => argument(call.args, '--tools') === '')).toBe(true)
    expect(result.ok && result.value.candidates.map((script) => script.props.format)).toEqual(['play-along', 'myth', 'challenge'])
    expect(result.ok && result.value.candidates.map((script) => script.verdict)).toEqual(['pass', 'pass', 'pass'])
    // Viewers name beats: the time is computed from the script (beat 1 ends at 2.5 s, beat 2 at 5.5 s).
    expect(result.ok && result.value.candidates[2]?.props.test?.understoodAt).toBe(2.5)
    expect(result.ok && result.value.candidates[1]?.props.test?.understoodAt).toBe(5.5)
    expect(result.ok && result.value.recommended).toBe(1)
    expect(activity).toHaveLength(4)
  })

  it('shows the viewer the screen and nothing else: not the brief, not the product’s pitch', async () => {
    const { run, calls } = scripted([success(written())], [success(viewer())], [success(viewer())], [success(viewer())], [success(revised())])

    await write(run)

    const watched = argument(calls[1]?.args ?? [], '-p') ?? ''
    expect(watched).toContain('Beat 1, 0.0–2.5 s | you see: Une page Wikipédia dont le nom est caviardé | you read: « Où est cette ville ? Tu as 5 secondes. »')
    expect(watched).not.toContain(brief.props.tagline)
    expect(watched).not.toContain(brief.props.summary)
  })

  it('tells the writer what each viewer understood, so it rewrites where they got lost', async () => {
    const { run, calls } = scripted([success(written())], [success(lost)], [success(viewer())], [success(viewer())], [success(revised())])

    await write(run)

    const revision = argument(calls[4]?.args ?? [], '-p') ?? ''
    expect(revision).toContain('In one sentence, the product is: Un jeu où l’on devine une ville à partir de sa page Wikipédia.')
    expect(revision).toContain('"confusing": [\n    "caviardé"\n  ]')
  })

  it('has Claude fix a script that breaks the rules before anyone watches it', async () => {
    const [hook, ...rest] = aScriptDraft().beats
    if (!hook) throw new Error('fixture')
    const named = aScriptDraft({ beats: [{ ...hook, onScreen: 'Tu connais Wiki Géo ?' }, ...rest] })
    const { run, calls } = scripted([success(written([named, ...scripts.slice(1)]))], [success(written())])

    await write(run)

    expect(argument(calls[1]?.args ?? [], '-p')).toContain("scripts[0] : L'accroche ne doit pas contenir le nom du produit.")
  })

  it('recommends the script the viewers clearly preferred over the writer’s pick', async () => {
    const { run } = scripted(
      [success(written())],
      [success(viewer())],
      [success(viewer())],
      [success(viewer())],
      [success(revised(0))],
      [success(lost)],
      [success(viewer())],
      [success(viewer())],
    )

    const result = await write(run)

    expect(result.ok && result.value.candidates[0]?.verdict).toBe('fail')
    expect(result.ok && result.value.recommended).toBe(1)
  })

  it('keeps the first scripts, tested, when the rewriting fails', async () => {
    const { run } = scripted([success(written())], [success(lost)], [success(viewer())], [success(viewer())], { kind: 'timed_out' })

    const result = await write(run)

    expect(result.ok && result.value.candidates.map((script) => script.verdict)).toEqual(['fail', 'pass', 'pass'])
    expect(result.ok && result.value.recommended).toBe(1)
  })

  it('offers the scripts untested when no viewer could watch them', async () => {
    const { run, calls } = scripted([success(written())], { kind: 'timed_out' }, { kind: 'timed_out' }, { kind: 'timed_out' })

    const result = await write(run)

    expect(calls).toHaveLength(4)
    expect(result.ok && result.value.candidates.map((script) => script.props.test)).toEqual([null, null, null])
  })

  it('reports a failure of the writing as a script failure', async () => {
    const result = await write(scripted({ kind: 'timed_out' }).run)
    expect(result.ok ? null : result.error.type).toBe('ScriptWritingFailed')
  })
})

describe('ClaudeCodeDemoScout', () => {
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
  const scout = (run: ProcessRunner) => new ClaudeCodeDemoScout(claudeWith(run)).scout({ brief, persona, folder })

  it('has Claude read the code, and only read, to pick pages for that persona', async () => {
    const { run, calls } = scripted([success({ language: 'fr', pages: [{ path: '/', shows: 'Le défi du jour' }, { path: '/classement', shows: 'Le classement' }] })])

    const pages = await scout(run)

    expect(pages.ok && pages.value).toEqual({ language: 'fr', pages: [{ path: '/', shows: 'Le défi du jour' }, { path: '/classement', shows: 'Le classement' }] })
    expect(calls[0]?.cwd).toBe('/home/ada/app')
    expect(argument(calls[0]?.args ?? [], '--tools')).toBe('Read,Glob,Grep')
    expect(argument(calls[0]?.args ?? [], '-p')).toContain('"name": "Léa"')
  })

  it('only keeps paths of the application, and asks again when there is none', async () => {
    const outside = { pages: [{ path: 'https://elsewhere.test/', shows: 'Ailleurs' }, { path: '//elsewhere.test', shows: 'Ailleurs' }] }
    const { run, calls } = scripted([success(outside)], [success({ language: 'French, obviously', pages: [{ path: '/', shows: "L'accueil" }, { path: 'http://x.test', shows: 'Ailleurs' }] })])

    const pages = await scout(run)

    // A language that is not a language code is not passed on to the browser.
    expect(pages.ok && pages.value).toEqual({ language: null, pages: [{ path: '/', shows: "L'accueil" }] })
    expect(argument(calls[1]?.args ?? [], '-p')).toContain('starting with "/"')
  })

  it('reports a failure as a scouting failure', async () => {
    const pages = await scout(scripted({ kind: 'timed_out' }).run)
    expect(pages.ok ? null : pages.error.type).toBe('DemoScoutingFailed')
  })
})

describe('ClaudeCodeStyleAdvisor', () => {
  const brief = (() => {
    const created = ProductBrief.create(aProductBriefDraft())
    if (!created.ok) throw new Error('fixture')
    return created.value
  })()
  const personas = (() => {
    const created = Personas.create([aPersonaDraft(), aPersonaDraft({ name: 'Marc' })], brief)
    if (!created.ok) throw new Error('fixture')
    return created.value
  })()
  const lea = { persona: 'Léa', look: 'pop', tone: 'genz', sound: 'effects', reason: 'Elle révise sur TikTok.' }
  const marc = { persona: 'Marc', look: 'neon', tone: 'dare', sound: 'beat', reason: 'Il joue le soir entre amis.' }
  const suggest = (run: ProcessRunner) => new ClaudeCodeStyleAdvisor(claudeWith(run)).suggest({ brief, personas, folder })

  it('proposes a look, a tone and a sound for each persona, from the brief and the personas alone', async () => {
    const { run, calls } = scripted([success({ styles: [marc, lea] })])

    const styles = await suggest(run)

    // In the order of the personas, whatever order Claude answered in.
    expect(styles.ok && styles.value).toEqual([lea, marc])
    expect(argument(calls[0]?.args ?? [], '--tools')).toBe('')
    const prompt = argument(calls[0]?.args ?? [], '-p') ?? ''
    expect(prompt).toContain('"name": "Léa"')
    expect(prompt).toContain('- "neon": glowing tubes of light on black')
    expect(prompt).toContain('- "dare": challenges the viewer')
  })

  it('has Claude fix a proposal that forgets a persona or picks the user’s own music', async () => {
    const { run, calls } = scripted([success({ styles: [{ ...lea, sound: 'track' }] })], [success({ styles: [lea, marc] })])

    const styles = await suggest(run)

    expect(styles.ok).toBe(true)
    const repair = argument(calls[1]?.args ?? [], '-p')
    expect(repair).toContain('There is no style for the persona "Marc".')
    expect(repair).toContain('Léa: "sound" must be one of none, effects, beat.')
  })

  it('reports a failure as a suggestion failure', async () => {
    const styles = await suggest(scripted({ kind: 'timed_out' }).run)
    expect(styles.ok ? null : styles.error.type).toBe('StyleSuggestionFailed')
  })
})

describe('ClaudeCodeCli', () => {
  const exited = (stdout: string, exitCode = 0): ProcessOutcome => ({ kind: 'exited', exitCode, stdout, stderr: '' })
  const cliWith = (run: ProcessRunner, candidates = ['claude'], now?: () => number) =>
    new ClaudeCodeCli(run, new ClaudeBinaryLocator(run, candidates), now)

  it('finds Claude Code where its installer put it when it is not in the PATH', async () => {
    const { run, calls } = scripted({ kind: 'not_found' }, exited('2.1.322 (Claude Code)'), exited('{"loggedIn": true}'))
    const cli = cliWith(run, ['claude', '/home/ada/.local/bin/claude'])

    expect(await cli.status()).toEqual({ state: 'ready', version: '2.1.322', executable: '/home/ada/.local/bin/claude' })
    expect(calls.map((call) => call.command)).toEqual(['claude', '/home/ada/.local/bin/claude', '/home/ada/.local/bin/claude'])
  })

  it('is missing when the command does not exist', async () => {
    const cli = cliWith(scripted({ kind: 'not_found' }).run)
    expect(await cli.status()).toEqual({ state: 'missing' })
  })

  it('is signed out when Claude Code says so', async () => {
    const cli = cliWith(scripted(exited('2.1.321 (Claude Code)'), exited('{"loggedIn": false}')).run)
    expect(await cli.status()).toEqual({ state: 'signed_out', version: '2.1.321', executable: 'claude' })
  })

  it('is ready when signed in', async () => {
    const cli = cliWith(scripted(exited('2.1.321 (Claude Code)'), exited('{"loggedIn": true}')).run)
    expect(await cli.status()).toEqual({ state: 'ready', version: '2.1.321', executable: 'claude' })
  })

  it('assumes an older version without `auth status` is usable', async () => {
    const cli = cliWith(scripted(exited('1.0.0 (Claude Code)'), exited('unknown command', 1)).run)
    expect((await cli.status()).state).toBe('ready')
  })

  it('remembers the answer for a few seconds, then asks again', async () => {
    let now = 0
    const { run, calls } = scripted(exited('2.1.0'), exited('{"loggedIn": false}'), exited('2.1.0'), exited('{"loggedIn": true}'))
    const cli = cliWith(run, ['claude'], () => now)

    await cli.status()
    expect((await cli.status()).state).toBe('signed_out')
    expect(calls).toHaveLength(2)

    now = 60_000
    expect((await cli.status()).state).toBe('ready')
  })
})
