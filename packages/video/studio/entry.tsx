// The root of a video directed by Claude. `@piece` is the workspace the piece is written
// in; this file is not in it, so that what gets rendered is always wrapped the same way.
import Video, { DURATION_SECONDS } from '@piece/Video'
import type { ReactNode } from 'react'
import { AbsoluteFill, Audio, Composition, Freeze, interpolate, registerRoot, staticFile, useVideoConfig } from 'remotion'
import { useFonts } from '../src/fonts'
import { FPS, HEIGHT, WIDTH, type PieceProps } from '../src/types'

const frames = Math.max(1, Math.round(DURATION_SECONDS * FPS))

/** Nothing is drawn before the typefaces are there: text measured with a fallback would be set wrong. */
const WithFonts = ({ piece, children }: { piece: PieceProps; children: ReactNode }) => {
  const ready = useFonts([piece.fonts.display, piece.fonts.body, piece.fonts.serif, piece.fonts.mono])
  return ready ? <>{children}</> : null
}

/** What is heard: files of the bundle's public folder, put there by the render script. */
type Sound = { audio?: { effects: string | null; music: string | null } }

const Piece = ({ audio, ...piece }: PieceProps & Sound) => {
  const { durationInFrames } = useVideoConfig()
  return (
    <WithFonts piece={piece}>
      <Video {...piece} />
      {audio?.effects && <Audio src={staticFile(audio.effects)} />}
      {/* The user's own music comes in quickly and fades out with the video. */}
      {audio?.music && (
        <Audio
          src={staticFile(audio.music)}
          volume={(frame) => interpolate(frame, [0, 6, durationInFrames - 30, durationInFrames - 1], [0, 0.75, 0.75, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
    </WithFonts>
  )
}

type SheetProps = { piece: PieceProps; /** The moments shown, in seconds. */ times: number[] }

const CELL = { width: 270, height: 480, gap: 12, label: 34, columns: 4 }

/** Moments of the video side by side, each with its time: what the director looks at to judge the piece. */
const Sheet = ({ piece, times }: SheetProps) => (
  <AbsoluteFill style={{ background: '#1c1c22', padding: CELL.gap, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: CELL.gap, alignContent: 'flex-start' }}>
    <WithFonts piece={piece}>
      {times.map((time) => (
        <div key={time} style={{ width: CELL.width }}>
          <div style={{ height: CELL.label, color: '#ffffff', font: '600 22px system-ui, sans-serif', lineHeight: `${CELL.label}px` }}>{time.toFixed(1)} s</div>
          <div style={{ position: 'relative', width: CELL.width, height: CELL.height, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', width: WIDTH, height: HEIGHT, transform: `scale(${CELL.width / WIDTH})`, transformOrigin: '0 0' }}>
              <Freeze frame={Math.min(frames - 1, Math.round(time * FPS))}>
                <Video {...piece} />
              </Freeze>
            </div>
          </div>
        </div>
      ))}
    </WithFonts>
  </AbsoluteFill>
)

const sheetSize = (count: number) => {
  const rows = Math.ceil(count / CELL.columns)
  return {
    width: CELL.columns * CELL.width + (CELL.columns + 1) * CELL.gap,
    height: rows * (CELL.height + CELL.label) + (rows + 1) * CELL.gap,
  }
}

const empty = { piece: null as unknown as PieceProps, times: [0] }

registerRoot(() => (
  <>
    <Composition id="Piece" component={Piece} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={frames} defaultProps={empty.piece} />
    <Composition
      id="Sheet"
      component={Sheet}
      fps={FPS}
      // As long as the piece, although one picture is taken of it: a frozen moment beyond
      // the end of the composition it is drawn in would be brought back to its first frame.
      durationInFrames={frames}
      {...sheetSize(12)}
      defaultProps={empty}
      calculateMetadata={({ props }) => sheetSize(props.times.length)}
    />
  </>
))
