#!/usr/bin/env node
// Draws one moment of the piece, larger than on a sheet, to check a detail.
//   node still.mjs 4.2        the frame at 4.2 s
// Run from the workspace. Writes review/still-4.2.png, or says what is wrong with the code.
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { renderStill, selectComposition } from '@remotion/renderer'
import { browserExecutable } from '../lib/browser.mjs'
import { bundlePiece, explain, pieceProps, readWorkspaceJob } from '../lib/studio.mjs'

const workspace = process.cwd()
const time = Number(process.argv[2])
if (!Number.isFinite(time) || time < 0) {
  console.log('Usage: node still.mjs <seconds>, for example: node still.mjs 4.2')
  process.exit(1)
}

try {
  const browser = await browserExecutable()
  const serveUrl = await bundlePiece(workspace)
  const inputProps = await pieceProps(await readWorkspaceJob(workspace))
  const composition = await selectComposition({ serveUrl, id: 'Piece', inputProps, browserExecutable: browser })
  const frame = Math.min(composition.durationInFrames - 1, Math.round(time * composition.fps))
  const name = `still-${time}.png`
  await mkdir(join(workspace, 'review'), { recursive: true })
  await renderStill({ composition, serveUrl, inputProps, frame, scale: 0.5, browserExecutable: browser, output: join(workspace, 'review', name) })
  console.log(`Still written to review/${name}. Look at it with the Read tool.`)
  process.exit(0)
} catch (error) {
  console.log(`The piece could not be drawn:\n${explain(error)}`)
  process.exit(1)
}
