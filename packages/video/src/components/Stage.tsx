import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { alpha, type Theme } from '../theme'
import { HEIGHT, WIDTH } from '../types'

const STRIPE = { angle: -28, width: 46, period: 150 }
/** Sliding the stripes sideways by this much brings them back onto themselves. */
const STRIPE_LOOP = STRIPE.period / Math.abs(Math.sin((STRIPE.angle * Math.PI) / 180))

/** Diagonal stripes that slide across the frame without ever showing a seam. */
const Stripes = ({ color }: { color: string }) => {
  const frame = useCurrentFrame()
  return (
    <div
      style={{
        position: 'absolute',
        inset: `0 ${-STRIPE_LOOP}px 0 0`,
        backgroundImage: `repeating-linear-gradient(${STRIPE.angle}deg, ${color} 0 ${STRIPE.width}px, transparent ${STRIPE.width}px ${STRIPE.period}px)`,
        transform: `translateX(${-((frame * 2.2) % STRIPE_LOOP)}px)`,
      }}
    />
  )
}

const masked = (mask: string): CSSProperties => ({ maskImage: mask, WebkitMaskImage: mask })

interface BackdropProps {
  theme: Theme
  /** The colour behind everything. */
  base: string
  /** What is drawn over it: lines, dots, bars. */
  ink: string
  /** The colour of the light on this shot. */
  glow: string
  fill: string
  /** Where the light, or the centre of the pattern, sits, in percent of the frame. */
  at: [number, number]
  intensity: number
}

/**
 * What is behind the text, one per look. Nothing in it stands still: that is what
 * separates motion design from slides.
 */
const Backdrop = ({ theme, base, ink, glow, fill, at, intensity }: BackdropProps) => {
  const frame = useCurrentFrame()
  const drift = (speed: number, range: number, phase = 0) => Math.sin(frame * speed + phase) * range
  const [x, y] = at

  switch (theme.backdrop) {
    case 'stripes':
      return <Stripes color={alpha(ink, 0.06)} />

    case 'grid':
      // Paper, a ruled grid, and one soft light.
      return (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: `linear-gradient(${alpha(ink, 0.05)} 2px, transparent 2px), linear-gradient(90deg, ${alpha(ink, 0.05)} 2px, transparent 2px)`,
              backgroundSize: '108px 108px',
              backgroundPosition: `0 ${-frame * 0.3}px`,
            }}
          />
          <AbsoluteFill style={{ background: `radial-gradient(70% 45% at ${x + drift(0.02, 5)}% ${y}%, ${alpha(glow, 0.13 * intensity)}, transparent 75%)` }} />
        </>
      )

    case 'rules':
      // A magazine page: a rule at the head, a rule at the foot, and nothing else.
      return (
        <>
          <div style={{ position: 'absolute', left: 96, right: 96, top: 170, height: 3, background: ink }} />
          <div style={{ position: 'absolute', left: 96, right: 96, top: 182, height: 1, background: alpha(ink, 0.5) }} />
          <div style={{ position: 'absolute', left: 96, right: 96, bottom: 150, height: 1, background: alpha(ink, 0.5) }} />
          <AbsoluteFill style={{ background: `radial-gradient(80% 50% at ${x}% ${y + drift(0.015, 4)}%, ${alpha(glow, 0.09 * intensity)}, transparent 75%)` }} />
        </>
      )

    case 'scanlines':
      // Darkness, the lines of a tube screen, and a ring of light breathing.
      return (
        <>
          <div
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: 1500,
              height: 1500,
              margin: -750,
              borderRadius: '50%',
              border: `5px solid ${alpha(glow, 0.7)}`,
              boxShadow: `0 0 70px ${alpha(glow, 0.8 * intensity)}, inset 0 0 70px ${alpha(glow, 0.5 * intensity)}, 0 0 260px ${alpha(fill, 0.35)}`,
              transform: `scale(${0.62 + drift(0.03, 0.025)})`,
              opacity: 0.55,
            }}
          />
          <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(0deg, ${alpha('#000000', 0.34)} 0 3px, transparent 3px 8px)`, backgroundPosition: `0 ${frame * 0.6}px` }} />
          <AbsoluteFill style={{ background: 'radial-gradient(75% 60% at 50% 45%, transparent 40%, rgba(0, 0, 0, 0.75) 100%)' }} />
        </>
      )

    case 'mesh': {
      // The brand's colours as pools of light that move through each other.
      const colors = theme.brand
      const pool = (index: number, px: number, py: number, size: string) =>
        `radial-gradient(${size} at ${px + drift(0.016 + index * 0.004, 16, index * 2)}% ${py + drift(0.013 + index * 0.003, 12, index + 1)}%, ${colors[index % colors.length]}, transparent 72%)`
      return (
        <AbsoluteFill
          style={{
            background: [pool(0, 15, 15, '85% 55%'), pool(1, 90, 45, '80% 50%'), pool(2, 25, 95, '90% 55%'), `linear-gradient(${frame * 0.4}deg, ${colors[0]}, ${colors[1] ?? base})`].join(', '),
          }}
        />
      )
    }

    case 'terminal':
      // A terminal window: its title bar, and the faint lines of the screen.
      return (
        <>
          <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(0deg, ${alpha(ink, 0.035)} 0 2px, transparent 2px 7px)` }} />
          <div
            style={{
              position: 'absolute',
              left: 56,
              right: 56,
              top: 150,
              bottom: 210,
              borderRadius: 34,
              border: `2px solid ${alpha(ink, 0.2)}`,
              background: alpha(ink, 0.025),
              boxShadow: `0 0 140px ${alpha(glow, 0.14 * intensity)}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 84, padding: '0 34px', borderBottom: `2px solid ${alpha(ink, 0.14)}` }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((dot) => (
                <span key={dot} style={{ width: 24, height: 24, borderRadius: '50%', background: dot }} />
              ))}
            </div>
          </div>
        </>
      )

    case 'dots':
      // Polka dots, sliding.
      return (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(${alpha(ink, 0.1)} 9px, transparent 10px)`,
            backgroundSize: '96px 96px',
            backgroundPosition: `${frame * 0.6}px ${frame * 0.6}px`,
          }}
        />
      )

    case 'bars':
      // A cinema screen: one soft light, and black bars above and below.
      return (
        <>
          <AbsoluteFill style={{ background: `radial-gradient(85% 42% at ${x + drift(0.012, 6)}% ${y}%, ${alpha(glow, 0.2 * intensity)}, transparent 75%)` }} />
          <AbsoluteFill style={{ background: `radial-gradient(70% 50% at 50% 46%, ${alpha('#ffffff', 0.05)}, transparent 80%)` }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 210, background: '#000000', borderBottom: `1px solid ${alpha(ink, 0.12)}` }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 330, background: '#000000', borderTop: `1px solid ${alpha(ink, 0.12)}` }} />
        </>
      )

    case 'rays':
      // A poster's sun: rays turning slowly from the foot of the frame.
      return (
        <AbsoluteFill
          style={{
            background: `repeating-conic-gradient(from ${frame * 0.18}deg at 50% ${(1500 / HEIGHT) * 100}%, ${alpha(glow, 0.2)} 0deg 9deg, transparent 9deg 18deg)`,
            ...masked(`radial-gradient(${WIDTH * 1.3}px ${HEIGHT * 0.8}px at 50% ${(1500 / HEIGHT) * 100}%, black 30%, transparent 100%)`),
          }}
        />
      )

    case 'glow':
      // Two lights that drift, and a fine grid that slides.
      return (
        <>
          <AbsoluteFill
            style={{
              background: [
                `radial-gradient(62% 40% at ${x + drift(0.021, 7)}% ${y + drift(0.017, 5, 1)}%, ${alpha(glow, 0.36 * intensity)}, transparent 70%)`,
                `radial-gradient(70% 44% at ${100 - x + drift(0.015, 8, 2)}% ${96 - y * 0.4 + drift(0.019, 4, 3)}%, ${alpha(fill, 0.2 * intensity)}, transparent 72%)`,
              ].join(', '),
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage: `radial-gradient(${alpha(ink, 0.1)} 1.6px, transparent 1.6px)`,
              backgroundSize: '60px 60px',
              backgroundPosition: `${frame * 0.35}px ${-frame * 0.5}px`,
              ...masked('radial-gradient(90% 70% at 50% 45%, black 20%, transparent 85%)'),
            }}
          />
        </>
      )
  }
}

interface StageProps {
  theme: Theme
  /** The colour of the light on this shot. */
  glow: string
  /** A second, fainter light. */
  fill?: string
  /** Where the main light sits, in percent of the frame. */
  at?: [number, number]
  /** From 0 to 1. */
  intensity?: number
  children: ReactNode
}

/** The stage a shot plays on, as its look paints it. */
export const Stage = ({ theme, glow, fill, at = [22, 30], intensity = 1, children }: StageProps) => (
  <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
    <Backdrop theme={theme} base={theme.bg} ink={theme.text} glow={glow} fill={fill ?? glow} at={at} intensity={intensity} />
    {children}
  </AbsoluteFill>
)

/**
 * The product's own shots. In the looks that flood, the brand's colour fills the frame,
 * with rays turning behind the logo; the others stay on their stage.
 */
export const Flood = ({ theme, center = [50, 42], children }: { theme: Theme; center?: [number, number]; children: ReactNode }) => {
  const frame = useCurrentFrame()
  const [x, y] = center
  const floods = theme.flood !== theme.bg

  return (
    <AbsoluteFill style={{ background: theme.flood, overflow: 'hidden' }}>
      {floods && theme.backdrop !== 'stripes' && theme.backdrop !== 'dots' ? (
        <>
          <AbsoluteFill
            style={{
              background: `repeating-conic-gradient(from ${frame * 0.22}deg at ${x}% ${y}%, ${alpha(theme.onFlood, 0.075)} 0deg 7.5deg, transparent 7.5deg 15deg)`,
              ...masked(`radial-gradient(150% 95% at ${x}% ${y}%, black 25%, transparent 100%)`),
            }}
          />
          <AbsoluteFill style={{ background: `radial-gradient(60% 38% at ${x}% ${y}%, ${alpha('#ffffff', 0.3)}, transparent 70%)` }} />
        </>
      ) : (
        <Backdrop theme={theme} base={theme.flood} ink={theme.onFlood} glow={theme.primary} fill={theme.accents[1] ?? theme.primary} at={center} intensity={1.3} />
      )}
      {/* On paper, thin rings widen around the logo instead. */}
      {!floods && (theme.backdrop === 'grid' || theme.backdrop === 'rules') && (
        <AbsoluteFill
          style={{
            background: `repeating-radial-gradient(circle at ${x}% ${y}%, transparent 0 ${118 + Math.sin(frame / 30) * 6}px, ${alpha(theme.onFlood, 0.07)} ${118 + Math.sin(frame / 30) * 6}px ${121 + Math.sin(frame / 30) * 6}px)`,
            ...masked(`radial-gradient(90% 60% at ${x}% ${y}%, black 10%, transparent 90%)`),
          }}
        />
      )}
      {children}
    </AbsoluteFill>
  )
}
