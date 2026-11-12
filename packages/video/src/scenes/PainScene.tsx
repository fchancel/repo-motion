import { useMemo } from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Stage } from '../components/Stage'
import { Words } from '../components/Words'
import { fitTogether } from '../text'
import { emphasize, sized } from '../look'
import { accentAt, alpha } from '../theme'
import { tokenize } from '../words'
import { painStarts } from '../timing.ts'
import { SAFE, SAFE_WIDTH, type SceneOf } from '../types'
import { displayStyle, type ShotProps } from './shared'

const CROSS_GAP = 36

/** What hurts today: one line per beat, each landing like a blow while the previous ones fade. */
export const PainScene = ({ scene, theme, frames, enter }: ShotProps & { scene: SceneOf<'pain'> }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const style = displayStyle(theme)
  const warn = accentAt(theme, 1)

  const { fits, starts } = useMemo(() => {
    const fits = fitTogether(scene.lines, style, { width: SAFE_WIDTH - 110, height: 340, max: sized(theme, 116), min: 56, lineHeight: 1.05 })
    return { fits, starts: painStarts(scene.lines, frames, enter) }
  }, [scene.lines, style.fontFamily, style.uppercase, theme.scale, frames, enter])

  const size = fits[0]?.size ?? 80
  const cross = size * 0.6

  // The words that hurt, run in a band behind the lines: the one of the line being read.
  const current = starts.reduce((line, start, index) => (frame >= start ? index : line), 0)
  const band = tokenize(scene.lines[current] ?? '')
    .filter((token) => token.emphasis)
    .map((token) => (theme.uppercase ? token.text.toUpperCase() : token.text))
    .join(' ')
  const sinceLine = frame - (starts[current] ?? 0)

  return (
    <Stage theme={theme} glow={warn} at={[80, 22]} intensity={0.75}>
      {theme.kinetic &&
        band &&
        [0, 1].map((row) => (
          <div
            key={row}
            style={{
              position: 'absolute',
              left: 0,
              top: row === 0 ? 40 : 1400,
              whiteSpace: 'nowrap',
              fontFamily: theme.display,
              fontStretch: theme.displayStretch,
              fontWeight: theme.displayWeight,
              fontSize: 250,
              lineHeight: 1,
              color: 'transparent',
              WebkitTextStroke: `3px ${alpha(theme.text, 0.13)}`,
              opacity: interpolate(sinceLine, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              transform: `translateX(${row === 0 ? -900 + frame * 7 : -frame * 7}px)`,
            }}
          >
            {Array.from({ length: 8 }, () => band).join('   ')}
          </div>
        ))}
      <AbsoluteFill
        style={{
          padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`,
          justifyContent: 'center',
          gap: size * 0.62,
        }}
      >
        {fits.map((fitted, index) => {
          const start = starts[index] ?? 0
          const next = starts[index + 1]
          const local = frame - start
          const landed = spring({ frame: local, fps, config: { damping: 13, stiffness: 200, mass: 0.6 } })
          // The line shakes as it lands, then settles.
          const shake = local >= 0 && theme.shake ? Math.sin(local * 1.9) * 16 * Math.exp(-local / 3.5) : 0
          const dimmed = next === undefined ? 1 : interpolate(frame, [next - 2, next + 7], [1, 0.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          const draw = (delay: number) => interpolate(local, [delay, delay + 5], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

          return (
            <div
              key={index}
              style={{ display: 'flex', gap: CROSS_GAP, opacity: local < 0 ? 0 : dimmed, transform: `translateX(${shake}px)` }}
            >
              <svg
                viewBox="0 0 24 24"
                width={cross}
                height={cross}
                fill="none"
                stroke={warn}
                strokeWidth={4}
                strokeLinecap="round"
                style={{ flexShrink: 0, marginTop: (size * fitted.lineHeight - cross) / 2, transform: `scale(${landed})` }}
              >
                <path d="M5 5 19 19" pathLength={1} strokeDasharray={1} strokeDashoffset={draw(0)} />
                <path d="M19 5 5 19" pathLength={1} strokeDasharray={1} strokeDashoffset={draw(3)} />
              </svg>
              <Words fitted={fitted} color={theme.text} emphasis={emphasize(theme, 'color', warn)} at={start + 1} stagger={1.8} />
            </div>
          )
        })}
      </AbsoluteFill>
    </Stage>
  )
}
