import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { LogoTile } from '../components/LogoTile'
import { Flood } from '../components/Stage'
import { sized } from '../look'
import { useFit } from '../text'
import { alpha } from '../theme'
import { buttonClicked, buttonLands, logoLands } from '../timing.ts'
import { HEIGHT, SAFE, SAFE_HEIGHT, SAFE_WIDTH, type SceneOf } from '../types'
import { RisingName } from './RevealScene'
import { displayStyle, type ShotProps } from './shared'

const TILE = 210
const GAP_NAME = 50
const GAP_BUTTON = 76
const BUTTON_HEIGHT = 168

/** The end card: the brand again, and the one thing to do, on a button that asks to be tapped. */
export const CtaScene = ({ scene, theme, video, enter }: ShotProps & { scene: SceneOf<'cta'> }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const name = useFit(video.product.name, { ...displayStyle(theme), uppercase: false }, { width: SAFE_WIDTH, height: 250, max: sized(theme, 160), min: 72, lineHeight: 0.98 })
  const label = useFit(scene.text, displayStyle(theme, 700), { width: SAFE_WIDTH - 150, height: 90, max: 72, min: 36, lineHeight: 1.1 })

  const land = logoLands(enter)
  const landed = spring({ frame: frame - land, fps, config: { damping: 12, stiffness: 150, mass: 0.8 } })
  const buttonAt = buttonLands(enter)
  const pressed = spring({ frame: frame - buttonAt, fps, config: { damping: 11, stiffness: 170, mass: 0.7 } })
  // A pointer comes for the button and clicks it: the button gives, then ripples.
  const clickAt = buttonClicked(enter)
  const approach = interpolate(frame, [buttonAt + 8, clickAt], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const clicked = spring({ frame: frame - clickAt, fps, config: { damping: 9, stiffness: 260, mass: 0.5 } })
  const settled = Math.max(0, frame - clickAt)
  const pulse = frame >= clickAt ? 0.93 + 0.07 * clicked : 1

  const block = TILE + GAP_NAME + name.height + GAP_BUTTON + BUTTON_HEIGHT
  const logoY = SAFE.top + (SAFE_HEIGHT - block) / 2 + TILE / 2

  return (
    <Flood theme={theme} center={[50, (logoY / HEIGHT) * 100]}>
      <AbsoluteFill
        style={{
          padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ transform: `scale(${landed}) rotate(${(1 - landed) * 14}deg)`, marginBottom: GAP_NAME }}>
          <LogoTile theme={theme} logo={video.logo} name={video.product.name} size={TILE} />
        </div>
        <RisingName fitted={name} color={theme.textGlow ? theme.primary : theme.onFlood} at={land + 6} glow={theme.textGlow ? theme.primary : undefined} />

        <div style={{ position: 'relative', marginTop: GAP_BUTTON, transform: `scale(${pressed * pulse})` }}>
          {/* Ripples leaving the button, as if it had just been tapped. */}
          {[0, 1].map((ring) => {
            const cycle = (settled + ring * 21) % 42
            const out = cycle / 42
            return (
              <div
                key={ring}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: BUTTON_HEIGHT,
                  border: `6px solid ${alpha(theme.onFlood, settled > 0 ? 0.5 * (1 - out) : 0)}`,
                  transform: `scale(${1 + out * 0.2}, ${1 + out * 0.55})`,
                }}
              />
            )
          })}
          <div
            style={{
              height: BUTTON_HEIGHT,
              padding: '0 88px',
              borderRadius: BUTTON_HEIGHT,
              background: theme.onFlood,
              color: theme.flood,
              boxShadow: theme.hardEdges ? `12px 12px 0 ${alpha(theme.onFlood, 0.35)}` : `0 26px 70px ${alpha('#000000', 0.34)}`,
              display: 'flex',
              alignItems: 'center',
              fontFamily: label.style.fontFamily,
              fontWeight: label.style.fontWeight,
              fontStretch: label.style.fontStretch ?? 'normal',
              letterSpacing: `${label.style.letterSpacing ?? 0}em`,
              fontSize: label.size,
              whiteSpace: 'nowrap',
              opacity: interpolate(frame, [buttonAt, buttonAt + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            }}
          >
            {label.lines
              .flat()
              .map((token) => token.text)
              .join(' ')}
          </div>
          <svg
            width={120}
            height={120}
            viewBox="0 0 24 24"
            style={{
              position: 'absolute',
              left: '58%',
              top: '46%',
              opacity: interpolate(frame, [buttonAt + 8, buttonAt + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              transform: `translate(${(1 - approach) * 300}px, ${(1 - approach) * 420}px) scale(${frame >= clickAt && frame < clickAt + 4 ? 0.82 : 1})`,
              transformOrigin: '20% 15%',
              filter: 'drop-shadow(0 8px 14px rgba(0, 0, 0, 0.35))',
            }}
          >
            <path d="M5 3l14 8-6.200 1.800L10 19z" fill="#ffffff" stroke="#0b0b10" strokeWidth={1.4} strokeLinejoin="round" />
          </svg>
        </div>
      </AbsoluteFill>
    </Flood>
  )
}
