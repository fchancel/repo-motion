#!/usr/bin/env node
// Draws moments of the piece side by side, for its director to look at.
//   node sheet.mjs            twelve moments over the whole video
//   node sheet.mjs 3.5 7      twelve moments between 3.5 s and 7 s
// Run from the workspace. Writes review/sheet.png, or says what is wrong with the code.
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { renderStill, selectComposition } from '@remotion/renderer'
import { browserExecutable } from '../lib/browser.mjs'
import { bundlePiece, explain, pieceProps, readWorkspaceJob } from '../lib/studio.mjs'

const workspace = process.cwd()
const COUNT = 12

try {
  const browser = await browserExecutable()
  const serveUrl = await bundlePiece(workspace)
  const piece = await pieceProps(await readWorkspaceJob(workspace))
  const video = await selectComposition({ serveUrl, id: 'Piece', inputProps: piece, browserExecutable: browser })
  const seconds = video.durationInFrames / video.fps

  const [from = 0, to = seconds] = process.argv.slice(2).map(Number).filter(Number.isFinite)
  const [start, end] = [Math.max(0, Math.min(from, seconds)), Math.max(0, Math.min(to, seconds))]
  // The last moment is just before the end: the very last frame is often a held one.
  const times = Array.from({ length: COUNT }, (_, index) => Math.round((start + ((end - start) * index) / (COUNT - 1)) * 10) / 10).map((time) => Math.min(time, seconds - 0.05))

  const inputProps = { piece, times }
  const sheet = await selectComposition({ serveUrl, id: 'Sheet', inputProps, browserExecutable: browser })
  const whole = start === 0 && end === seconds
  const name = whole ? 'sheet.png' : `sheet-${start}-${end}.png`
  await mkdir(join(workspace, 'review'), { recursive: true })
  await renderStill({ composition: sheet, serveUrl, inputProps, browserExecutable: browser, output: join(workspace, 'review', name) })

  console.log(`The video lasts ${seconds.toFixed(1)} s.`)
  console.log(`Sheet written to review/${name}: ${times.map((time) => `${time.toFixed(1)} s`).join(', ')}.`)
  console.log('Look at it with the Read tool.')
  process.exit(0)
} catch (error) {
  console.log(`The piece could not be drawn:\n${explain(error)}`)
  process.exit(1)
}
