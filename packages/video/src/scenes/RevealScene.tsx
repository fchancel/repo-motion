import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { LogoTile } from '../components/LogoTile'
import { Flood } from '../components/Stage'
import { Words } from '../components/Words'
import { countWords, useFit, type Fitted } from '../text'
import { emphasize, sized } from '../look'
import { alpha, type Theme } from '../theme'
import { logoLands } from '../timing.ts'
import { HEIGHT, SAFE, SAFE_HEIGHT, SAFE_WIDTH, type SceneOf } from '../types'
import { displayStyle, staggerFor, type ShotProps } from './shared'

const TILE = 290
const GAP_NAME = 64
const GAP_LINE = 46

/** The product's name, each line rising from behind a mask. */
export const RisingName = ({ fitted, color, at, glow }: { fitted: Fitted; color: string; at: number; glow?: string | undefined }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <div
      style={{
        fontFamily: fitted.style.fontFamily,
        fontWeight: fitted.style.fontWeight,
        fontStretch: fitted.style.fontStretch ?? 'normal',
        letterSpacing: `${fitted.style.letterSpacing ?? 0}em`,
        fontSize: fitted.size,
        lineHeight: fitted.lineHeight,
        color,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        textShadow: glow ? `0 0 0.08em ${glow}, 0 0 0.3em ${glow}, 0 0 0.9em ${alpha(glow, 0.7)}` : undefined,
      }}
    >
      {fitted.lines.map((line, lineIndex) => {
        const letters = [...line.map((token) => token.text).join(' ')]
        return (
          // Padding keeps accents and descenders inside the mask.
          <div key={lineIndex} style={{ overflow: glow ? 'visible' : 'hidden', padding: '0.12em 0.06em', margin: '-0.12em -0.06em', whiteSpace: 'pre' }}>
            {letters.map((letter, index) => {
              // Each letter rises a beat after the one before, and straightens as it lands.
              const risen = spring({ frame: frame - at - lineIndex * 4 - index * 1.3, fps, config: { damping: 15, stiffness: 190, mass: 0.6 } })
              return (
                <span key={index} style={{ display: 'inline-block', opacity: glow ? risen : 1, transform: `translateY(${(1 - risen) * 115}%) rotate(${(1 - risen) * 14}deg)` }}>
                  {letter}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** Rings thrown outwards when the logo lands. */
const Impact = ({ theme, at, size }: { theme: Theme; at: number; size: number }) => {
  const frame = useCurrentFrame()
  return (
    <>
      {[0, 6].map((delay) => {
        const progress = interpolate(frame, [at + delay, at + delay + 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const eased = 1 - (1 - progress) ** 3
        return (
          <div
            key={delay}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: size * 0.235,
              border: `7px solid ${alpha(theme.onFlood, 0.55 * (1 - progress))}`,
              transform: `scale(${1 + eased * 2.2})`,
              opacity: progress > 0 ? 1 : 0,
            }}
          />
        )
      })}
    </>
  )
}

/** The turn of the story: the brand's colour floods the frame, and the product lands. */
export const RevealScene = ({ scene, theme, video, frames, enter }: ShotProps & { scene: SceneOf<'reveal'> }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  // A name is written the way the brand writes it, whatever the look does to the rest.
  const name = useFit(video.product.name, { ...displayStyle(theme), uppercase: false }, { width: SAFE_WIDTH, height: 330, max: sized(theme, 210), min: 84, lineHeight: 0.98 })
  const line = useFit(scene.line, displayStyle(theme, 600), { width: SAFE_WIDTH - 30, height: 360, max: sized(theme, 80), min: 46, lineHeight: 1.16 })

  const land = logoLands(enter)
  const landed = spring({ frame: frame - land, fps, config: { damping: 11, stiffness: 150, mass: 0.8 } })
  const nameAt = land + 7
  const lineAt = nameAt + name.lines.length * 4 + 9
  const words = countWords(scene.line)

  // The rays turn around the logo, wherever the block puts it.
  const block = TILE + GAP_NAME + name.height + GAP_LINE + line.height
  const logoY = SAFE.top + (SAFE_HEIGHT - block) / 2 + TILE / 2

  return (
    <Flood theme={theme} center={[50, (logoY / HEIGHT) * 100]}>
      <AbsoluteFill
        style={{
          padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`,
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${interpolate(frame, [0, frames], [1, 1.045])})`,
        }}
      >
        <div style={{ position: 'relative', transform: `scale(${landed}) rotate(${(1 - landed) * -16}deg)`, marginBottom: GAP_NAME }}>
          <Impact theme={theme} at={land + 3} size={TILE} />
          <LogoTile theme={theme} logo={video.logo} name={video.product.name} size={TILE} />
        </div>
        <RisingName fitted={name} color={theme.textGlow ? theme.primary : theme.onFlood} at={nameAt} glow={theme.textGlow ? theme.primary : undefined} />
        <Words
          fitted={line}
          color={theme.onFlood}
          // Where the colour floods the frame, the highlight is the frame's own ink; elsewhere, the look's.
          emphasis={theme.flood === theme.bg ? emphasize(theme, 'color', theme.primary) : { type: 'box', background: theme.onFlood, color: theme.flood }}
          align="center"
          at={lineAt}
          stagger={staggerFor(words, (frames - lineAt) * 0.5)}
          style={{ marginTop: GAP_LINE }}
        />
      </AbsoluteFill>
    </Flood>
  )
}
