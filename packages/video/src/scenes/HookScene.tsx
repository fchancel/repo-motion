import { useMemo } from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Stage } from '../components/Stage'
import { Words } from '../components/Words'
import { emphasize, sized } from '../look'
import { fit, useFit } from '../text'
import { accentAt, alpha, inkOn } from '../theme'
import { hookBeats, hookWords } from '../timing.ts'
import { HEIGHT, SAFE, SAFE_HEIGHT, SAFE_WIDTH, WIDTH, type SceneOf } from '../types'
import { displayStyle, type ShotProps } from './shared'

const CENTER_Y = SAFE.top + SAFE_HEIGHT / 2

/** A shape thrown in with each word: never the same twice in a row. */
const Shape = ({ index, color, progress }: { index: number; color: string; progress: number }) => {
  const frame = useCurrentFrame()
  switch (index % 4) {
    case 0:
      // A ring, top right.
      return <div style={{ position: 'absolute', left: 640, top: 150, width: 620, height: 620, borderRadius: '50%', border: `46px solid ${color}`, transform: `scale(${progress})` }} />
    case 1:
      // A bar sweeping in from the left, under the word.
      return <div style={{ position: 'absolute', left: -40, top: CENTER_Y + 250, width: 760 * progress, height: 54, background: color, transform: 'rotate(-4deg)' }} />
    case 2:
      // A grid of squares, bottom right.
      return (
        <div style={{ position: 'absolute', left: 610, top: 1180, display: 'grid', gridTemplateColumns: 'repeat(4, 76px)', gap: 22 }}>
          {Array.from({ length: 12 }, (_, square) => (
            <span key={square} style={{ width: 76, height: 76, background: color, opacity: square % 3 === 0 ? 1 : 0.35, transform: `scale(${Math.min(1, Math.max(0, progress * 1.6 - (square % 4) * 0.12))})` }} />
          ))}
        </div>
      )
    default:
      // A half disc rising from the top left, turning.
      return <div style={{ position: 'absolute', left: -260, top: 60, width: 640, height: 640, borderRadius: '50%', background: color, clipPath: 'inset(0 0 50% 0)', transform: `rotate(${-30 + frame * 1.5}deg) scale(${progress})` }} />
  }
}

/**
 * The hook thrown at the viewer: each word alone, filling the frame, for a few frames,
 * with a shape of its own; the words that matter flood the frame in the brand's colour.
 * Then the sentence assembles, so that it can be read whole.
 */
const KineticHook = ({ scene, theme, frames }: ShotProps & { scene: SceneOf<'hook'> }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const style = displayStyle(theme)
  const accent = accentAt(theme, 0)

  const { tokens, starts, assemble } = useMemo(() => hookBeats(scene.text, frames), [scene.text, frames])
  const solos = useMemo(
    () => tokens.map((token) => fit(token.text, style, { width: SAFE_WIDTH * 0.9, height: 620, max: sized(theme, 400), min: 110, lineHeight: 0.98 })),
    [tokens, style.fontFamily, style.fontWeight, style.uppercase, theme.scale],
  )
  const sentence = useFit(scene.text, style, { width: SAFE_WIDTH, height: 940, max: sized(theme, 178), min: 72, lineHeight: 1.03 })

  if (frame >= assemble) {
    const local = frame - assemble
    const settle = spring({ frame: local, fps, config: { damping: 16, stiffness: 150, mass: 0.7 } })
    return (
      <Stage theme={theme} glow={accent} fill={accentAt(theme, 2)} at={[18, 24]}>
        <AbsoluteFill
          style={{
            padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`,
            justifyContent: 'center',
            transform: `scale(${1.12 - 0.12 * settle + interpolate(frame, [assemble, frames], [0, 0.05])})`,
            transformOrigin: `30% ${(CENTER_Y / HEIGHT) * 100}%`,
          }}
        >
          <Words fitted={sentence} color={theme.text} emphasis={emphasize(theme, 'box', accent)} at={assemble - 1} stagger={0.7} />
        </AbsoluteFill>
      </Stage>
    )
  }

  const index = starts.reduce((current, start, candidate) => (frame >= start ? candidate : current), 0)
  const token = tokens[index]
  const solo = solos[index]
  if (!token || !solo) return null

  const local = frame - (starts[index] ?? 0)
  const hit = spring({ frame: local, fps, config: { damping: 14, stiffness: 300, mass: 0.45 } })
  // The words that matter take the whole frame in the brand's colour.
  const flooded = token.emphasis
  const ink = flooded ? inkOn(theme, accent) : theme.text
  const shape = flooded ? alpha(ink, 0.16) : index % 2 === 0 ? accent : alpha(theme.text, 0.2)

  return (
    <Stage theme={theme} glow={accent} fill={accentAt(theme, 2)} at={[18, 24]}>
      {flooded && <AbsoluteFill style={{ background: accent }} />}
      <Shape index={index} color={shape} progress={hit} />
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          width: WIDTH - SAFE.left - SAFE.right,
          top: CENTER_Y - solo.height / 2,
          // Each word lands from a little too big: never bigger than the frame.
          transform: `scale(${1.1 - 0.1 * hit}) rotate(${(1 - hit) * (index % 2 === 0 ? -5 : 5)}deg)`,
        }}
      >
        <Words fitted={solo} color={ink} emphasis={{ type: 'color', color: ink }} align="center" at={-99} stagger={0} />
      </div>
    </Stage>
  )
}

/** The hook written out, word after word: for the looks that do not raise their voice. */
const WrittenHook = ({ scene, theme, frames }: ShotProps & { scene: SceneOf<'hook'> }) => {
  const frame = useCurrentFrame()
  const fitted = useFit(scene.text, displayStyle(theme), { width: SAFE_WIDTH, height: 940, max: sized(theme, 178), min: 72, lineHeight: 1.03 })
  const accent = accentAt(theme, 0)

  return (
    <Stage theme={theme} glow={accent} fill={accentAt(theme, 2)} at={[18, 24]}>
      <AbsoluteFill
        style={{
          padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`,
          justifyContent: 'center',
          transform: `scale(${interpolate(frame, [0, frames], [1, 1.07])})`,
          transformOrigin: `30% ${(CENTER_Y / HEIGHT) * 100}%`,
        }}
      >
        <Words fitted={fitted} color={theme.text} emphasis={emphasize(theme, 'box', accent)} {...hookWords(scene.text, frames)} />
      </AbsoluteFill>
    </Stage>
  )
}

/**
 * The first words. They are already there on the very first frame: a viewer decides to
 * stay or swipe in well under a second.
 */
export const HookScene = (props: ShotProps & { scene: SceneOf<'hook'> }) => (props.theme.kinetic ? <KineticHook {...props} /> : <WrittenHook {...props} />)
