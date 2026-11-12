import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion'
import { Stage } from '../components/Stage'
import { Words } from '../components/Words'
import { countWords, useFit } from '../text'
import { emphasize, sized } from '../look'
import { accentAt, type Theme } from '../theme'
import { benefitStarts } from '../timing.ts'
import { HEIGHT, SAFE, SAFE_HEIGHT, SAFE_WIDTH, WIDTH, type SceneOf } from '../types'
import { displayStyle, staggerFor, type ShotProps } from './shared'

const PIECES = 46

/** A burst of the brand's colours from behind the text: the pain is gone. */
const Confetti = ({ theme, at }: { theme: Theme; at: number }) => {
  const frame = useCurrentFrame()
  const time = frame - at
  if (time < 0) return null

  const [originX, originY] = [WIDTH / 2, SAFE.top + SAFE_HEIGHT / 2]
  return (
    <>
      {Array.from({ length: PIECES }, (_, index) => {
        const angle = random(`angle-${index}`) * Math.PI * 2
        const speed = 420 + random(`speed-${index}`) * 760
        // Thrown fast, slowed by the air, then falling.
        const travelled = speed * (1 - Math.exp(-time / 11))
        const x = originX + Math.cos(angle) * travelled
        const y = originY + Math.sin(angle) * travelled * 1.25 + 0.3 * time * time
        const width = 16 + random(`size-${index}`) * 22
        const round = random(`shape-${index}`) > 0.62

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width,
              height: round ? width : width * 0.42,
              borderRadius: round ? '50%' : 4,
              background: accentAt(theme, index),
              opacity: interpolate(time, [0, 3, 34, 58], [0, 1, 1, 0], { extrapolateRight: 'clamp' }),
              transform: `rotate(${time * (random(`spin-${index}`) * 26 - 13)}deg)`,
            }}
          />
        )
      })}
    </>
  )
}

/** The after: one statement, centred, with the words that matter underlined as they land. */
export const BenefitScene = ({ scene, theme, frames, enter }: ShotProps & { scene: SceneOf<'benefit'> }) => {
  const frame = useCurrentFrame()
  const fitted = useFit(scene.text, displayStyle(theme), { width: SAFE_WIDTH, height: 860, max: sized(theme, 164), min: 68, lineHeight: 1.06 })
  const accent = accentAt(theme, 0)
  const at = benefitStarts(enter)
  const center = ((SAFE.top + SAFE_HEIGHT / 2) / HEIGHT) * 100

  return (
    <Stage theme={theme} glow={accent} fill={accentAt(theme, 1)} at={[50, center]} intensity={1.2}>
      {theme.confetti && <Confetti theme={theme} at={at + 2} />}
      <AbsoluteFill
        style={{
          padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`,
          justifyContent: 'center',
          transform: `scale(${interpolate(frame, [0, frames], [1, 1.06])})`,
          transformOrigin: `50% ${center}%`,
        }}
      >
        <Words
          fitted={fitted}
          color={theme.text}
          emphasis={emphasize(theme, 'underline', accent)}
          align="center"
          at={at}
          stagger={staggerFor(countWords(scene.text), frames * 0.4)}
        />
      </AbsoluteFill>
    </Stage>
  )
}
