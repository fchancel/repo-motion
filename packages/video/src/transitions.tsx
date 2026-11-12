import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions'
import { AbsoluteFill } from 'remotion'
import { HEIGHT, WIDTH } from './types'

type IrisProps = { /** Where the circle opens from, in percent of the frame. */ center: [number, number] }

/** The next shot opens as a circle that grows until it covers the frame. */
const Iris = ({ children, presentationDirection, presentationProgress, passedProps }: TransitionPresentationComponentProps<IrisProps>) => {
  const [x, y] = passedProps.center
  if (presentationDirection === 'exiting') {
    return <AbsoluteFill style={{ transform: `scale(${1 - presentationProgress * 0.06})` }}>{children}</AbsoluteFill>
  }
  const radius = presentationProgress * Math.hypot(WIDTH, HEIGHT)
  return <AbsoluteFill style={{ clipPath: `circle(${radius}px at ${x}% ${y}%)` }}>{children}</AbsoluteFill>
}

export const iris = (center: [number, number] = [50, 45]): TransitionPresentation<IrisProps> => ({ component: Iris, props: { center } })

/** The camera pushes through the leaving shot into the next one. */
const Zoom = ({ children, presentationDirection, presentationProgress }: TransitionPresentationComponentProps<Record<string, never>>) => {
  const style =
    presentationDirection === 'exiting'
      ? { transform: `scale(${1 + presentationProgress * 0.45})`, opacity: 1 - presentationProgress }
      : { transform: `scale(${0.8 + presentationProgress * 0.2})`, opacity: presentationProgress }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>
}

export const zoom = (): TransitionPresentation<Record<string, never>> => ({ component: Zoom, props: {} })

type SnapProps = { /** The colour of the flash. */ flash: string }

/** A hard cut: the next shot is there at once, slightly too big, under a flash that dies out. */
const Snap = ({ children, presentationDirection, presentationProgress, passedProps }: TransitionPresentationComponentProps<SnapProps>) => {
  if (presentationDirection === 'exiting') return <AbsoluteFill>{children}</AbsoluteFill>
  return (
    <AbsoluteFill style={{ transform: `scale(${1.16 - 0.16 * presentationProgress})` }}>
      {children}
      <AbsoluteFill style={{ background: passedProps.flash, opacity: (1 - presentationProgress) ** 2 * 0.9 }} />
    </AbsoluteFill>
  )
}

export const snap = (flash: string): TransitionPresentation<SnapProps> => ({ component: Snap, props: { flash } })

type TilesProps = { /** What the squares are painted with: the colour of the shot they open on. */ color: string }

const COLUMNS = 6
const ROWS = 11

/**
 * Squares grow from the middle of the frame until they cover the leaving shot, then
 * shrink away to uncover the next one, which is the colour they were painted with.
 */
const Tiles = ({ children, presentationDirection, presentationProgress, passedProps }: TransitionPresentationComponentProps<TilesProps>) => {
  if (presentationDirection === 'exiting') return <AbsoluteFill>{children}</AbsoluteFill>
  const closing = presentationProgress < 0.5
  const size = WIDTH / COLUMNS
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: closing ? 0 : 1 }}>{children}</AbsoluteFill>
      {Array.from({ length: COLUMNS * ROWS }, (_, index) => {
        const [column, row] = [index % COLUMNS, Math.floor(index / COLUMNS)]
        // The squares nearest the middle move first.
        const distance = Math.hypot(column - (COLUMNS - 1) / 2, row - (ROWS - 1) / 2) / Math.hypot(COLUMNS / 2, ROWS / 2)
        const phase = closing ? presentationProgress * 2 : 2 - presentationProgress * 2
        const scale = Math.min(1, Math.max(0, (phase * 1.5 - distance * 0.5) * 1.6))
        return (
          <div
            key={index}
            style={{ position: 'absolute', left: column * size, top: row * (HEIGHT / ROWS), width: size + 1, height: HEIGHT / ROWS + 1, background: passedProps.color, transform: `scale(${scale})` }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

export const tiles = (color: string): TransitionPresentation<TilesProps> => ({ component: Tiles, props: { color } })
