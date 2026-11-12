// The headless browser that draws the videos and photographs the application.
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureBrowser } from '@remotion/renderer'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * Where the browser is. Remotion keeps it beside wherever it is run from, and would
 * download another copy for each folder: it is always looked for, and kept, in this package.
 */
export const browserExecutable = async () => {
  const here = process.cwd()
  process.chdir(root)
  try {
    const browser = await ensureBrowser()
    return 'path' in browser ? browser.path : null
  } finally {
    process.chdir(here)
  }
}
