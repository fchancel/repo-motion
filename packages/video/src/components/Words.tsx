import type { CSSProperties } from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { useTheme } from '../look'
import type { Fitted } from '../text'
import { alpha, type Theme } from '../theme'

export type Emphasis =
  /** A highlighter box behind the word. */
  | { type: 'box'; background: string; color: string }
  | { type: 'color'; color: string }
  /** The word takes the colour, and a stroke draws itself under it. */
  | { type: 'underline'; color: string }
  /** The word is a tube of light. */
  | { type: 'glow'; color: string }
  /** The word leans, as in a magazine. */
  | { type: 'italic'; color: string }
  /** The word is a sticker: outlined, tilted, with a hard shadow. */
  | { type: 'sticker'; background: string; color: string; outline: string }
  /** The word casts a hard shadow, as on a poster. */
  | { type: 'shadow'; color: string; shadow: string }

interface WordsProps {
  fitted: Fitted
  color: string
  emphasis: Emphasis
  align?: 'left' | 'center'
  /** Frame at which the first word appears. */
  at?: number
  /** Frames between two words. */
  stagger?: number
  /**
   * `pop`: each word springs in. `karaoke`: the text is there, dimmed, and each word
   * lights up when it is its turn to be read.
   */
  mode?: 'pop' | 'karaoke'
  style?: CSSProperties
}

const SPRINGS: Record<Theme['motion'], { damping: number; stiffness: number; mass?: number }> = {
  pop: { damping: 15, stiffness: 190, mass: 0.6 },
  slam: { damping: 22, stiffness: 320, mass: 0.5 },
  rise: { damping: 200, stiffness: 120 },
  blur: { damping: 200, stiffness: 90 },
  bounce: { damping: 8, stiffness: 170, mass: 0.6 },
  type: { damping: 200, stiffness: 400 },
  flicker: { damping: 200, stiffness: 400 },
}

/** How a word arrives. `local`: frames since its turn. `progress`: its spring, from 0 to 1. */
const arrival = (motion: Theme['motion'], local: number, progress: number, index: number): CSSProperties => {
  const appear = (frames: number) => interpolate(local, [0, frames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  switch (motion) {
    case 'slam':
      // Slammed onto the frame: too big, then in place, with no travel.
      return { opacity: appear(1), transform: `scale(${1.55 - 0.55 * progress})` }
    case 'rise':
      // Laid down gently.
      return { opacity: appear(7), transform: `translateY(${(1 - progress) * 0.22}em)` }
    case 'blur':
      // Coming into focus.
      return { opacity: appear(9), filter: `blur(${(1 - progress) * 0.28}em)`, transform: `scale(${1.08 - 0.08 * progress})` }
    case 'bounce':
      // Dropped, and wobbling as it settles.
      return { opacity: appear(2), transform: `translateY(${(1 - progress) * -0.5}em) rotate(${(1 - progress) * (index % 2 === 0 ? -9 : 9)}deg)` }
    case 'type':
      // Typed: not there, then there.
      return { opacity: local >= 0 ? 1 : 0 }
    case 'flicker':
      // A tube catching: on, off, on.
      return { opacity: local < 0 ? 0 : local < 2 ? 1 : local < 4 ? 0.25 : local < 5 ? 0.9 : local < 6 ? 0.5 : 1 }
    case 'pop':
      return { opacity: appear(3), transform: `translateY(${(1 - progress) * 0.42}em) scale(${0.72 + 0.28 * progress})` }
  }
}

/** Text that arrives word by word, the way short videos are read. */
export const Words = ({ fitted, color, emphasis, align = 'left', at = 0, stagger = 2.4, mode = 'pop', style }: WordsProps) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = useTheme()
  const { size, lines, lineHeight, gap } = fitted
  const config = SPRINGS[theme.motion]
  const words = lines.reduce((count, line) => count + line.length, 0)
  // The caret of a typed text: after the last word typed, blinking once all of it is there.
  const typed = Math.min(words - 1, Math.floor((frame - at) / stagger))
  const caret = theme.motion === 'type' && mode === 'pop' && (typed < words - 1 || Math.floor(frame / 8) % 2 === 0)
  let index = -1

  return (
    <div
      style={{
        fontFamily: fitted.style.fontFamily,
        fontWeight: fitted.style.fontWeight,
        fontStretch: fitted.style.fontStretch ?? 'normal',
        letterSpacing: `${fitted.style.letterSpacing ?? 0}em`,
        fontSize: size,
        lineHeight,
        color,
        textShadow: theme.textGlow ? `0 0 0.14em ${alpha(color, 0.55)}, 0 0 0.5em ${alpha(color, 0.25)}` : undefined,
        ...style,
      }}
    >
      {lines.map((line, lineIndex) => (
        <div
          key={lineIndex}
          style={{ display: 'flex', gap: `${gap}em`, justifyContent: align === 'center' ? 'center' : 'flex-start', whiteSpace: 'nowrap' }}
        >
          {line.map((token) => {
            index += 1
            const local = frame - at - index * stagger
            const progress = spring({ frame: local, fps, config })
            const highlighted = token.emphasis

            const wordStyle: CSSProperties =
              mode === 'pop'
                ? arrival(theme.motion, local, progress, index)
                : { opacity: interpolate(local, [0, 5], [0.3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }

            return (
              <span
                key={index}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  transformOrigin: '50% 80%',
                  color: highlighted ? emphasis.color : undefined,
                  ...(highlighted ? highlight(emphasis) : {}),
                  ...wordStyle,
                }}
              >
                {highlighted && emphasis.type === 'sticker' && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: '0.03em -0.14em 0',
                      zIndex: -1,
                      borderRadius: '0.14em',
                      background: emphasis.background,
                      border: `0.045em solid ${emphasis.outline}`,
                      boxShadow: `0.07em 0.07em 0 ${emphasis.outline}`,
                      transform: `rotate(${index % 2 === 0 ? -2 : 1.5}deg) scale(${spring({ frame: local - 1, fps, config: { damping: 9, stiffness: 200, mass: 0.5 } })})`,
                    }}
                  />
                )}
                {highlighted && emphasis.type === 'box' && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: '0.05em -0.125em 0.02em',
                      zIndex: -1,
                      borderRadius: '0.1em',
                      background: emphasis.background,
                      transformOrigin: '0 50%',
                      transform: `scaleX(${spring({ frame: local - 1, fps, config: { damping: 200, stiffness: 220 } })})`,
                    }}
                  />
                )}
                {highlighted && emphasis.type === 'underline' && (
                  <span
                    style={{
                      position: 'absolute',
                      left: '-0.04em',
                      right: '-0.04em',
                      bottom: '0.02em',
                      height: '0.085em',
                      borderRadius: '0.05em',
                      background: emphasis.color,
                      transformOrigin: '0 50%',
                      transform: `scaleX(${spring({ frame: local - 4, fps, config: { damping: 200, stiffness: 160 } })})`,
                    }}
                  />
                )}
                {token.text}
                {caret && index === typed && (
                  <span style={{ position: 'absolute', left: '100%', top: '0.14em', width: '0.56em', height: '0.82em', marginLeft: highlighted ? '0.28em' : '0.1em', background: color }} />
                )}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** What a highlighted word wears, besides its colour and whatever is drawn behind it. */
const highlight = (emphasis: Emphasis): CSSProperties => {
  switch (emphasis.type) {
    case 'glow':
      return { textShadow: `0 0 0.1em ${emphasis.color}, 0 0 0.35em ${emphasis.color}, 0 0 0.9em ${alpha(emphasis.color, 0.7)}` }
    case 'italic':
      return { fontStyle: 'italic' }
    case 'shadow':
      return { textShadow: `0.055em 0.055em 0 ${emphasis.shadow}` }
    default:
      return {}
  }
}

/** When the last word of a block has landed. */
export const wordsEnd = (fitted: Fitted, at: number, stagger: number): number =>
  at + fitted.lines.reduce((count, line) => count + line.length, 0) * stagger
