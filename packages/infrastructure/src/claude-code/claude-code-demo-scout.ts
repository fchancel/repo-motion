import type { DemoScout, DemoScouting, DemoScoutingFailed, DemoScoutingRequest, Persona, ProductBrief, Result } from '@repo-motion/core'
import { err, ok, VIDEO_SETUP_RULES } from '@repo-motion/core'
import { z } from 'zod'
import type { AnswerRejected, ClaudePromptRunner } from './claude-prompt-runner'

const SYSTEM_PROMPT = `You prepare the demo shot of a short video about a software product: a phone films a few pages of the real application while it runs.

Your job is to choose which pages to film. Read the application's code to find the pages it really has, then pick the ones that show best what matters to the person the video is for.

Rules:
- Only propose pages that exist in the code. Find the routes first (pages folder, router configuration); never guess a path.
- Only propose pages that open by themselves: no sign-in, no identifier to know in advance, no step to complete first. A path with a parameter is only usable if the code gives a real value for it (a list of known slugs, for instance).
- Prefer pages where the product itself is visible over pages of text (legal notices, about pages).
- The first page is the one shown longest: make it the most telling.
- "path" is the path of the page in the application, starting with "/". No domain, no port.
- "shows" says in a few words what a viewer sees on that page, in the language of the brief.
- "language" is the language the brief is written in, as a code ("fr", "en", "pt-BR"). The application is filmed in that language: if it picks its language from the address (a path prefix, a query parameter), write the paths so that it opens in it.
- You may only read. Do not run anything.`

const prompt = (brief: ProductBrief, persona: Persona): string => `Here is the product:

${JSON.stringify({ name: brief.props.productName, summary: brief.props.summary, features: brief.props.features.map((feature) => feature.name) }, null, 2)}

Here is the person the video is for:

${JSON.stringify({ name: persona.name, role: persona.role, goal: persona.goal, keyFeatures: persona.keyFeatures }, null, 2)}

Pick 1 to ${VIDEO_SETUP_RULES.maxDemoPages} pages of this application to film for them. If only the home page opens by itself, propose "/" alone.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pages', 'language'],
  properties: {
    language: { type: 'string', minLength: 2, maxLength: 12 },
    pages: {
      type: 'array',
      minItems: 1,
      maxItems: VIDEO_SETUP_RULES.maxDemoPages,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'shows'],
        properties: { path: { type: 'string', minLength: 1 }, shows: { type: 'string', minLength: 1 } },
      },
    },
  },
} as const

const answerSchema = z.object({ pages: z.array(z.object({ path: z.string(), shows: z.string() })), language: z.string().optional() })

const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/

/** Only paths inside the application are kept: the answer is a proposal, not an address to trust. */
export const readDemoPages = (answer: unknown): Result<DemoScouting, AnswerRejected> => {
  const parsed = answerSchema.safeParse(answer)
  if (!parsed.success) return err({ problems: 'The answer must be an object with a "pages" array of { path, shows }.' })

  const pages = parsed.data.pages
    .map((page) => ({ path: page.path.trim(), shows: page.shows.trim().slice(0, 140) }))
    .filter((page) => page.path.startsWith('/') && !page.path.startsWith('//'))
    .slice(0, VIDEO_SETUP_RULES.maxDemoPages)
  const language = parsed.data.language?.trim() ?? ''
  return pages.length > 0 ? ok({ pages, language: LANGUAGE.test(language) ? language : null }) : err({ problems: 'Every "path" must be a path of the application starting with "/", such as "/" or "/pricing".' })
}

const TIMEOUT_MS = 6 * 60_000

/** Has the user's Claude Code read the application's routes and pick the pages worth filming. */
export class ClaudeCodeDemoScout implements DemoScout {
  constructor(private readonly claude: ClaudePromptRunner) {}

  async scout(request: DemoScoutingRequest): Promise<Result<DemoScouting, DemoScoutingFailed>> {
    const pages = await this.claude.askFor(
      {
        prompt: prompt(request.brief, request.persona),
        systemPrompt: SYSTEM_PROMPT,
        schema: SCHEMA,
        // Reading only: the routes are in the code.
        tools: 'Read,Glob,Grep',
        cwd: request.folder.path,
        timeoutMs: TIMEOUT_MS,
      },
      readDemoPages,
    )
    return pages.ok ? pages : err({ type: 'DemoScoutingFailed', ...pages.error })
  }
}
