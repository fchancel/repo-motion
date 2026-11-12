#!/usr/bin/env node
// Renders one video. Usage: node render.mjs <job.json> [--stills 0,45,90]
//
// The application runs this in its own process and reads what it prints: one JSON object
// per line, `{"progress":0.4}` while rendering, then `{"done":true,…}` or `{"error":"…"}`.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { writeScoredSoundtrack, writeSoundtrack } from './audio/soundtrack.mjs'
import { findBrandFont, LOOK_FACES, ownFont, readLogo, readScreens } from './lib/assets.mjs'
import { browserExecutable } from './lib/browser.mjs'
import { bundlePiece, pieceProps } from './lib/studio.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const COMPOSITION = 'PersonaVideo'

const say = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)

// ── Bundle ──────────────────────────────────────────────────────────────────

const sourceFiles = async (folder) => {
  const entries = await readdir(folder, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? sourceFiles(join(folder, entry.name)) : [join(folder, entry.name)])),
  )
  return nested.flat().sort()
}

/**
 * Bundling the compositions takes several seconds and gives the same result until their
 * source changes: the bundle is kept, under a name made from the source's content.
 */
const bundleOnce = async () => {
  const hash = createHash('sha1')
  for (const file of await sourceFiles(join(here, 'src'))) hash.update(file).update(await readFile(file))
  const cache = join(here, '.cache')
  const target = join(cache, `bundle-${hash.digest('hex').slice(0, 12)}`)
  if (existsSync(join(target, 'index.html'))) return target

  await mkdir(cache, { recursive: true })
  const building = `${target}.${process.pid}.tmp`
  await bundle({ entryPoint: join(here, 'src', 'index.ts'), outDir: building })
  try {
    await rename(building, target)
  } catch {
    // Another render finished the same bundle first: use theirs.
    await rm(building, { recursive: true, force: true })
  }

  // Older bundles are removed, but not one a render started moments ago may still be reading.
  for (const name of await readdir(cache)) {
    const other = join(cache, name)
    if (!name.startsWith('bundle-') || other === target || name.endsWith('.tmp')) continue
    const age = Date.now() - (await stat(other)).mtimeMs
    if (age > 60 * 60_000) await rm(other, { recursive: true, force: true })
  }
  return target
}

// ── Sound ───────────────────────────────────────────────────────────────────

/**
 * Puts what the video plays into the bundle's public folder, under names of its own.
 * Returns what to play, and how to remove it once the video is rendered.
 */
const prepareSound = async (serveUrl, job, write) => {
  const kind = job.sound?.kind ?? 'none'
  if (kind === 'none') return { audio: { effects: null, music: null }, clean: async () => undefined }
  // Checked before anything is written: nothing is left behind if the file is gone.
  if (kind === 'track' && (!job.sound.track || !existsSync(job.sound.track))) {
    throw new JobError(`Le fichier audio « ${job.sound.track ?? ''} » est introuvable. Choisissez-en un autre dans les réglages.`)
  }

  const folder = join(serveUrl, 'public', 'sound')
  await mkdir(folder, { recursive: true })
  const id = createHash('sha1').update(`${job.output}:${process.pid}`).digest('hex').slice(0, 12)
  const files = []

  const effects = `sound/${id}.wav`
  await writeFile(join(serveUrl, 'public', effects), write(kind).toWav())
  files.push(effects)

  let music = null
  if (kind === 'track') {
    music = `sound/${id}${extname(job.sound.track).toLowerCase()}`
    await copyFile(job.sound.track, join(serveUrl, 'public', music))
    files.push(music)
  }

  const clean = () => Promise.all(files.map((file) => rm(join(serveUrl, 'public', file), { force: true })))
  return { audio: { effects, music }, clean }
}

/** An error whose message is meant for the user. */
class JobError extends Error {}

// ── What is rendered ────────────────────────────────────────────────────────

/** A video made of the package's own shots, from a storyboard. */
const templateVideo = async (job) => {
  // Pictures of the application that cannot be read are left out; with none left, so is the demo shot.
  const screens = await readScreens(job.screens)
  const scenes = job.scenes.filter((scene) => scene.kind !== 'demo' || screens.length > 0)

  const [logo, brandFont, display, body, serveUrl] = await Promise.all([
    readLogo(job.projectFolder, job.brand.logoPath),
    findBrandFont(job.projectFolder, job.brand.fonts),
    ownFont('bricolage-grotesque'),
    ownFont('instrument-sans'),
    bundleOnce(),
  ])

  const extra = {}
  for (const [role, [name, italics]] of Object.entries(LOOK_FACES[job.look] ?? {})) extra[role] = await ownFont(name, italics)

  const sound = await prepareSound(serveUrl, job, (kind) => writeSoundtrack({ scenes, look: job.look ?? 'brand', kind }))
  const inputProps = {
    look: job.look ?? 'brand',
    screens,
    audio: sound.audio,
    product: { name: job.product.name },
    colors: job.brand.colors,
    logo,
    fonts: { display: brandFont ?? display, body, ...extra },
    scenes,
  }
  return { serveUrl, inputProps, sound, id: COMPOSITION }
}

/**
 * A video Claude directed: its code is in a workspace, and so is the score of its sound.
 * The sound is mixed in afterwards by the piece's own wrapper, from the same public folder.
 */
const directedPiece = async (job) => {
  const { workspace } = job.directed
  const serveUrl = await bundlePiece(workspace)
  const piece = await pieceProps(job)
  // How long the piece lasts is in its own code: the composition knows.
  const { durationInFrames, fps } = await selectComposition({ serveUrl, id: 'Piece', inputProps: piece, browserExecutable: await browserExecutable() })
  const score = await readFile(join(workspace, 'sound.json'), 'utf8').then(JSON.parse, () => null)
  const silent = (job.sound?.kind ?? 'none') === 'none' || (!score && job.sound.kind !== 'track')
  const sound = await prepareSound(serveUrl, silent ? { ...job, sound: { kind: 'none' } } : job, (kind) =>
    writeScoredSoundtrack({ seconds: durationInFrames / fps, score, kind }),
  )
  // The bundle of a piece is only good for this render: it goes with the sound once the video is made.
  const clean = async () => {
    await sound.clean()
    await rm(serveUrl, { recursive: true, force: true })
  }
  return { serveUrl, inputProps: { ...piece, audio: sound.audio }, sound: { ...sound, clean }, id: 'Piece' }
}

// ── Render ──────────────────────────────────────────────────────────────────

const main = async () => {
  const [jobFile, ...flags] = process.argv.slice(2)
  if (!jobFile) throw new Error('Usage: node render.mjs <job.json> [--stills 0,45,90]')
  const job = JSON.parse(await readFile(jobFile, 'utf8'))
  const stills = flags[0] === '--stills' ? (flags[1] ?? '').split(',').map(Number).filter(Number.isFinite) : null

  const { serveUrl, inputProps, sound, id } = job.directed ? await directedPiece(job) : await templateVideo(job)

  try {
    const browser = await browserExecutable()
    const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable: browser })
    await mkdir(dirname(job.output), { recursive: true })

    if (stills) {
      for (const frame of stills) {
        const output = `${job.output}.${String(frame).padStart(4, '0')}.png`
        await renderStill({ composition, serveUrl, inputProps, frame: Math.min(frame, composition.durationInFrames - 1), output, scale: 0.5, browserExecutable: browser })
        say({ still: output })
      }
      return
    }

    // Rendered beside, then renamed: the application never serves a half-written video.
    const rendering = `${job.output}.rendering.mp4`
    let reported = -1
    await renderMedia({
      composition,
      serveUrl,
      inputProps,
      codec: 'h264',
      browserExecutable: browser,
      crf: 17,
      imageFormat: 'jpeg',
      jpegQuality: 95,
      outputLocation: rendering,
      onProgress: ({ progress }) => {
        const rounded = Math.round(progress * 100) / 100
        if (rounded === reported) return
        reported = rounded
        say({ progress: rounded })
      },
    })
    await rename(rendering, job.output)
    say({ done: true, file: job.output, seconds: composition.durationInFrames / composition.fps })
  } finally {
    await sound.clean()
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    say({ error: error instanceof JobError ? error.message : error instanceof Error ? error.message.split('\n')[0] : String(error) })
    console.error(error)
    process.exit(1)
  },
)
