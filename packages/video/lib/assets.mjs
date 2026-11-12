// The product's own assets, read from its folder: its logo, its typeface, the pictures
// taken of it while it runs. Nothing is downloaded.
import { existsSync } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

const require = createRequire(import.meta.url)

export const dataUrl = async (file, type) => `data:${type};base64,${(await readFile(file)).toString('base64')}`

const IMAGE_TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const MAX_LOGO_BYTES = 2_000_000

/** The path comes from an analysis written by a model: it must stay inside the project, and be an image. */
export const readLogo = async (projectFolder, logoPath) => {
  if (!logoPath) return null
  try {
    const root = await realpath(projectFolder)
    const file = await realpath(resolve(root, logoPath))
    const type = IMAGE_TYPES[extname(file).toLowerCase()]
    if (!type || relative(root, file).startsWith('..') || !file.startsWith(root + sep)) return null
    if ((await stat(file)).size > MAX_LOGO_BYTES) return null
    return await dataUrl(file, type)
  } catch {
    return null
  }
}

const SUBSETS = ['latin', 'latin-ext']

/**
 * Reads a typeface from a Fontsource package (`@fontsource/x` or `@fontsource-variable/x`):
 * the two weights the video uses, or the whole range when the font is variable.
 */
export const readFontsource = async (packageFolder, italics = false) => {
  const metadata = JSON.parse(await readFile(join(packageFolder, 'metadata.json'), 'utf8'))
  const ranges = JSON.parse(await readFile(join(packageFolder, 'unicode.json'), 'utf8'))
  const files = await readdir(join(packageFolder, 'files'))
  const variable = files.some((name) => /-(standard|wght)-normal\.woff2$/.test(name))
  const faces = []

  for (const subset of SUBSETS) {
    const face = async (name, weight, stretch) => {
      if (!files.includes(name)) return
      faces.push({
        src: await dataUrl(join(packageFolder, 'files', name), 'font/woff2'),
        weight,
        ...(name.endsWith('-italic.woff2') ? { style: 'italic' } : {}),
        ...(stretch ? { stretch } : {}),
        ...(ranges[subset] ? { unicodeRange: ranges[subset] } : {}),
      })
    }

    if (variable) {
      const axes = metadata.variable ?? {}
      const standard = `${metadata.id}-${subset}-standard-normal.woff2`
      const hasWidth = files.includes(standard) && axes.wdth
      await face(
        hasWidth ? standard : `${metadata.id}-${subset}-wght-normal.woff2`,
        `${axes.wght?.min ?? 100} ${axes.wght?.max ?? 900}`,
        hasWidth ? `${axes.wdth.min}% ${axes.wdth.max}%` : undefined,
      )
      if (italics) await face(`${metadata.id}-${subset}-wght-italic.woff2`, `${axes.wght?.min ?? 100} ${axes.wght?.max ?? 900}`)
    } else {
      const weights = metadata.weights ?? [400]
      const nearest = (target) => weights.reduce((best, weight) => (Math.abs(weight - target) < Math.abs(best - target) ? weight : best))
      for (const weight of new Set([nearest(800), nearest(600)])) {
        await face(`${metadata.id}-${subset}-${weight}-normal.woff2`, String(weight))
      }
    }
  }
  return faces.length > 0 ? { family: metadata.family, faces } : null
}

/** The typefaces that ship with repo-motion. */
export const ownFont = (name, italics = false) => readFontsource(dirname(require.resolve(`@fontsource-variable/${name}/package.json`)), italics)

/** The looks set in a typeface of their own, whatever the brand's is. */
export const LOOK_FACES = { editorial: { serif: ['fraunces', true] }, terminal: { mono: ['jetbrains-mono', false] } }

/**
 * The product's own display typeface, when the project installed it from Fontsource.
 * Nothing is downloaded: a font that is not on this machine is simply not used.
 */
export const findBrandFont = async (projectFolder, families) => {
  const family = families?.[0]
  if (!family) return null
  const id = family.toLowerCase().trim().replace(/\s+/g, '-')
  if (!/^[a-z0-9-]+$/.test(id)) return null

  for (const scope of ['@fontsource-variable', '@fontsource']) {
    const folder = join(projectFolder, 'node_modules', scope, id)
    if (!existsSync(join(folder, 'metadata.json'))) continue
    try {
      const font = await readFontsource(folder)
      if (font) return font
    } catch {
      // Not the layout we know: fall back to our own typeface.
    }
  }
  return null
}

/** The pictures of the application, as data URLs. One that cannot be read is left out. */
export const readScreens = async (files) =>
  (await Promise.all((files ?? []).map((file) => dataUrl(file, 'image/jpeg').catch(() => null)))).filter(Boolean)
