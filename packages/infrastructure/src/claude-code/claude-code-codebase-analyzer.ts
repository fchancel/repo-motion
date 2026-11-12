import type { CodebaseAnalysisFailed, CodebaseAnalysisRequest, CodebaseAnalyzer, ProductBrief, Result } from '@repo-motion/core'
import { err } from '@repo-motion/core'
import { ANALYSIS_PROMPT, ANALYSIS_SYSTEM_PROMPT, PRODUCT_BRIEF_SCHEMA } from './analysis-prompt'
import type { ClaudePromptRunner } from './claude-prompt-runner'
import { readProductBrief } from './product-brief-document'
import { readActivity } from './stream-events'

/** Read-only tools: nothing in the repository can make Claude run, write or fetch anything. */
const READ_ONLY_TOOLS = 'Read,Glob,Grep'

/** Has the user's Claude Code read their folder, in place, and describe the product it holds. */
export class ClaudeCodeCodebaseAnalyzer implements CodebaseAnalyzer {
  constructor(
    private readonly claude: ClaudePromptRunner,
    private readonly options: { readonly timeoutMs: number },
  ) {}

  async analyze(request: CodebaseAnalysisRequest): Promise<Result<ProductBrief, CodebaseAnalysisFailed>> {
    const folder = request.folder.path

    const brief = await this.claude.askFor(
      {
        prompt: ANALYSIS_PROMPT,
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        schema: PRODUCT_BRIEF_SCHEMA,
        tools: READ_ONLY_TOOLS,
        cwd: folder,
        timeoutMs: this.options.timeoutMs,
        onLine: (line) => {
          const activity = readActivity(line, folder)
          if (activity) request.onActivity?.(activity)
        },
      },
      readProductBrief,
      () => request.onActivity?.('Correction du brief'),
    )

    return brief.ok ? brief : err({ type: 'CodebaseAnalysisFailed', ...brief.error })
  }
}
