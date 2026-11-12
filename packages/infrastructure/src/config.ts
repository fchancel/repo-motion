import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'

const optional = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined)

const schema = z.object({
  /** Where projects and their briefs are stored. */
  REPO_MOTION_HOME: optional.transform((value) => value ?? join(homedir(), '.repo-motion')),
  /** The Claude Code executable. Unset: looked up in the PATH, then where its installer puts it. */
  REPO_MOTION_CLAUDE_BIN: optional,
  /** Model used for analyses. Unset: whatever the user configured in Claude Code. */
  REPO_MOTION_MODEL: optional,
  REPO_MOTION_ANALYSIS_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(20),
  /** The folder the application was launched from, offered as the first project. */
  REPO_MOTION_LAUNCH_DIR: optional,
  /** The script that renders a video. Unset: found in repo-motion's own folder. */
  REPO_MOTION_RENDER_SCRIPT: optional,
  REPO_MOTION_RENDER_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(15),
  /** How long Claude may work on directing one video. */
  REPO_MOTION_DIRECTOR_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(45),
})

export type InfrastructureConfig = z.infer<typeof schema>

/** Everything has a default: the application runs with no configuration at all. */
export const loadConfig = (env: Record<string, string | undefined> = process.env): InfrastructureConfig => {
  const parsed = schema.safeParse(env)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')
    throw new Error(`Invalid configuration:\n${problems}\nSee .env.example.`)
  }
  return parsed.data
}

/** Looks for the video package's render script, from `from` up to the root of the disk. */
export const findRenderScript = (from: string = process.cwd()): string | null => {
  for (let directory = from; ; directory = dirname(directory)) {
    const candidate = join(directory, 'packages', 'video', 'render.mjs')
    if (existsSync(candidate)) return candidate
    if (dirname(directory) === directory) return null
  }
}

/** The studio in which Claude directs a video sits next to the script that renders. */
export const studioBeside = (renderScript: string | null): string | null => {
  const candidate = renderScript ? join(dirname(renderScript), 'studio') : null
  return candidate && existsSync(join(candidate, 'GUIDE.md')) ? candidate : null
}

/** The script that photographs the running application sits next to the one that renders. */
export const captureScriptBeside = (renderScript: string | null): string | null => {
  const candidate = renderScript ? join(dirname(renderScript), 'capture.mjs') : null
  return candidate && existsSync(candidate) ? candidate : null
}
