import { isAbsolute, relative } from 'node:path'
import { z } from 'zod'

/**
 * The lines Claude Code prints with `--output-format stream-json`. Only the parts we use
 * are described; everything else is ignored, so new event types never break the analysis.
 */
const toolUse = z.object({ type: z.literal('tool_use'), name: z.string(), input: z.record(z.string(), z.unknown()).default({}) })

const assistantEvent = z.object({
  type: z.literal('assistant'),
  parent_tool_use_id: z.string().nullish(),
  message: z.object({ content: z.array(z.unknown()) }),
})

const resultEvent = z.object({
  type: z.literal('result'),
  subtype: z.string().optional(),
  is_error: z.boolean().optional(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
})

export type ResultEvent = z.infer<typeof resultEvent>

const parseLine = (line: string): unknown => {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

export const readResult = (line: string): ResultEvent | null => {
  const parsed = resultEvent.safeParse(parseLine(line))
  return parsed.success ? parsed.data : null
}

/**
 * What Claude is doing while it directs a video, in French: writing its code, drawing a
 * sheet of its frames, looking at them. Null if the line says nothing of it.
 */
export const readDirectingActivity = (line: string, workspace: string): string | null => {
  const event = assistantEvent.safeParse(parseLine(line))
  if (!event.success || event.data.parent_tool_use_id) return null

  for (const block of event.data.message.content) {
    const tool = toolUse.safeParse(block)
    if (!tool.success) continue
    const { name, input } = tool.data
    const value = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : null)
    const file = value('file_path')
    // Claude gives full paths; one given as it stands in the workspace is taken as it is.
    const local = file ? (isAbsolute(file) ? relative(workspace, file) : file) : null

    if (name === 'Write' || name === 'Edit') {
      if (local === 'NOTES.md') return 'Écrit le concept et le découpage'
      if (local === 'sound.json') return 'Compose la bande-son'
      return local ? `Écrit ${local}` : "Écrit le code de l'animation"
    }
    if (name === 'Bash') {
      const command = value('command') ?? ''
      if (command.includes('sheet.mjs')) return 'Tire une planche de ses images'
      if (command.includes('still.mjs')) return 'Tire une image pour vérifier un détail'
    }
    if (name === 'Read') {
      if (local?.startsWith('review/')) return 'Regarde ses images et les critique'
      if (local === 'BRIEF.md' || local === 'GUIDE.md') return 'Lit le brief'
    }
    if (name === 'StructuredOutput') return 'Rend son compte rendu'
  }
  return null
}

/** A short description, in French, of what Claude just started doing — or null if the line says nothing of it. */
export const readActivity = (line: string, folder: string): string | null => {
  const event = assistantEvent.safeParse(parseLine(line))
  // Only the main conversation: what subagents do would make the feed jump around.
  if (!event.success || event.data.parent_tool_use_id) return null

  for (const block of event.data.message.content) {
    const tool = toolUse.safeParse(block)
    if (!tool.success) continue
    const { name, input } = tool.data
    const value = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : null)

    if (name === 'Read') {
      const file = value('file_path')
      return file ? `Lecture de ${relative(folder, file) || file}` : 'Lecture du code'
    }
    if (name === 'Glob') return `Recherche de fichiers : ${value('pattern') ?? '…'}`
    if (name === 'Grep') return `Recherche de « ${value('pattern') ?? '…'} » dans le code`
    if (name === 'StructuredOutput') return 'Rédaction du brief'
  }
  return null
}
