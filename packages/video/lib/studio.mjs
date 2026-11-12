// Bundles and draws a video directed by Claude, from the workspace it is written in.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { findBrandFont, ownFont, readLogo, readScreens } from './assets.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/** What the application wrote for this piece: the product, its assets, the choices made. */
export const readWorkspaceJob = async (workspace) => JSON.parse(await readFile(join(workspace, 'job.json'), 'utf8'))

/**
 * Bundles the piece. Its code is only ever run in the headless browser: here it is read
 * and packed, never executed. `@piece` is the workspace, `@kit` what it may build with.
 */
export const bundlePiece = (workspace) =>
  bundle({
    entryPoint: join(root, 'studio', 'entry.tsx'),
    outDir: join(workspace, '.build'),
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: { ...(config.resolve?.alias ?? {}), '@piece': join(workspace, 'src'), '@kit': join(root, 'src', 'kit.ts') },
        // The workspace has no dependencies of its own: it uses this package's.
        modules: [join(root, 'node_modules'), 'node_modules'],
      },
    }),
  })

/** Everything the piece is given: the product's identity and its own assets. */
export const pieceProps = async (job) => {
  const [logo, brandFont, display, body, serif, mono, screens] = await Promise.all([
    readLogo(job.projectFolder, job.brand.logoPath),
    findBrandFont(job.projectFolder, job.brand.fonts),
    ownFont('bricolage-grotesque'),
    ownFont('instrument-sans'),
    ownFont('fraunces', true),
    ownFont('jetbrains-mono'),
    readScreens(job.screens),
  ])
  return {
    product: { name: job.product.name },
    colors: job.brand.colors,
    logo,
    fonts: { display: brandFont ?? display, body, serif, mono },
    screens,
    look: job.look ?? 'brand',
  }
}

/** The part of an error a director can act on: what is wrong and where, without the stack. */
export const explain = (error) => {
  const text = error instanceof Error ? error.message : String(error)
  return text
    .split('\n')
    .filter((line) => !/^\s+at /.test(line))
    .join('\n')
    .slice(0, 3000)
}
