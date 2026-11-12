import type { CSSProperties, ReactNode } from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Icon } from '../components/Icon'
import { alpha, inkOn, mix, type Theme } from '../theme'

/** The window a feature's interface plays in, in the frame's pixels. */
export const VIGNETTE = { width: 888, height: 540 }
const HEADER = 86
const PAD = 44

interface VignetteProps {
  /** Which interface, and the words written on it. */
  visual: { type: string; items: string[] }
  icon: string
  theme: Theme
  accent: string
  /** Frame at which the interface starts to move. */
  at: number
}

/** What every interface receives. */
interface Play {
  items: string[]
  theme: Theme
  accent: string
  /** Ink that reads on the accent. */
  onAccent: string
  /** Frames since the interface started. */
  frame: number
  fps: number
}

const clampOpts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ramp = (frame: number, from: number, to: number) => interpolate(frame, [from, to], [0, 1], clampOpts)
const easeOut = (value: number) => 1 - (1 - value) ** 3
const pop = (play: Play, at: number, config = { damping: 13, stiffness: 190, mass: 0.6 }) => spring({ frame: play.frame - at, fps: play.fps, config })

const label = (theme: Theme, size = 42, weight = 600): CSSProperties => ({
  fontFamily: theme.body,
  fontWeight: weight,
  fontSize: size,
  lineHeight: 1.15,
  letterSpacing: '-0.01em',
  color: theme.text,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 26 }

// ── The interfaces ──────────────────────────────────────────────────────────

/** Someone types a query, and results slide in under it. */
const Search = (play: Play) => {
  const { items, theme, accent, frame } = play
  const query = items[0] ?? ''
  const typed = query.slice(0, Math.max(0, Math.floor((frame - 4) / 1.1)))
  const done = 4 + query.length * 1.1
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ ...row, height: 104, padding: '0 34px', borderRadius: 52, background: alpha(theme.text, 0.08), border: `3px solid ${frame < done + 6 ? accent : alpha(theme.text, 0.18)}` }}>
        <Icon name="search" size={48} color={accent} at={-99} />
        <span style={label(theme, 46)}>
          {typed}
          <span style={{ opacity: Math.floor(frame / 7) % 2 === 0 ? 1 : 0, color: accent }}>|</span>
        </span>
      </div>
      {items.slice(1).map((item, index) => {
        const shown = pop(play, done + 5 + index * 6)
        return (
          <div key={index} style={{ ...row, padding: '0 20px', opacity: shown, transform: `translateY(${(1 - shown) * 40}px)` }}>
            <span style={{ width: 62, height: 62, borderRadius: 18, flexShrink: 0, background: index === 0 ? accent : alpha(theme.text, 0.14) }} />
            <span style={label(theme)}>{item}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Lines get ticked, one after the other. */
const Checklist = (play: Play) => {
  const { items, theme, accent, onAccent, frame } = play
  return (
    <div style={{ display: 'grid', gap: 26 }}>
      {items.map((item, index) => {
        const shown = pop(play, 2 + index * 5)
        const tickAt = 16 + index * 11
        const ticked = pop(play, tickAt, { damping: 10, stiffness: 220, mass: 0.5 })
        return (
          <div key={index} style={{ ...row, opacity: shown, transform: `translateX(${(1 - shown) * -50}px)` }}>
            <span
              style={{
                width: 66,
                height: 66,
                borderRadius: 20,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                border: `4px solid ${frame >= tickAt ? accent : alpha(theme.text, 0.3)}`,
                background: frame >= tickAt ? accent : 'transparent',
                transform: `scale(${frame >= tickAt ? 0.7 + 0.3 * ticked : 1})`,
              }}
            >
              <svg viewBox="0 0 24 24" width={44} height={44} fill="none" stroke={onAccent} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5 10 17.5 19 7" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(frame, tickAt, tickAt + 6)} />
              </svg>
            </span>
            <span style={{ ...label(theme), opacity: frame >= tickAt ? 1 : 0.6 }}>{item}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Bars grow, each taller than the last. */
const Chart = (play: Play) => {
  const { items, theme, accent, frame } = play
  const height = VIGNETTE.height - HEADER - PAD * 2 - 60
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 30, height: height + 60 }}>
      {items.map((item, index) => {
        const grown = easeOut(ramp(frame, 4 + index * 6, 26 + index * 6))
        const last = index === items.length - 1
        return (
          <div key={index} style={{ flex: 1, display: 'grid', gap: 14, justifyItems: 'center', minWidth: 0 }}>
            <div
              style={{
                width: '100%',
                height: height * (0.34 + (0.66 * (index + 1)) / items.length) * grown,
                borderRadius: '22px 22px 6px 6px',
                background: last ? accent : alpha(theme.text, 0.16),
                boxShadow: last && !theme.hardEdges ? `0 0 70px ${alpha(accent, 0.45)}` : undefined,
              }}
            />
            <span style={{ ...label(theme, 32), maxWidth: '100%', opacity: 0.85 }}>{item}</span>
          </div>
        )
      })}
    </div>
  )
}

/** A number counts up to its value. */
const Counter = (play: Play) => {
  const { items, theme, accent, frame } = play
  const shown = items[0] ?? '0'
  const target = Number(shown.replace(/[^\d]/g, '')) || 0
  const counted = Math.round(target * easeOut(ramp(frame, 3, 34)))
  // The digits are counted; whatever surrounds them (a unit, a sign) stays as it was written.
  const [before = '', after = ''] = shown.split(/\d[\d\s.,\u00A0\u202F]*\d|\d/)
  const grouped = /[\s\u00A0\u202F]/.test(shown) ? counted.toLocaleString('fr-FR') : String(counted)
  const landed = pop(play, 34, { damping: 9, stiffness: 200, mass: 0.6 })
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
      <span
        style={{
          fontFamily: theme.display,
          fontStretch: theme.displayStretch,
          fontWeight: theme.displayWeight,
          fontSize: 210,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color: accent,
          fontVariantNumeric: 'tabular-nums',
          transform: `scale(${1 + 0.07 * (1 - landed) * (frame >= 34 ? 1 : 0)})`,
          textShadow: theme.hardEdges ? `8px 8px 0 ${theme.text}` : undefined,
        }}
      >
        {before}
        {grouped}
        {after}
      </span>
      <div style={{ width: 520 * easeOut(ramp(frame, 3, 34)), height: 10, borderRadius: 5, background: alpha(theme.text, 0.25) }} />
      {items[1] && <span style={{ ...label(theme, 44), marginTop: 12, opacity: ramp(frame, 20, 30) }}>{items[1]}</span>}
    </div>
  )
}

/** A globe turns, and a pin drops on it. */
const Map = (play: Play) => {
  const { items, theme, accent, onAccent, frame } = play
  const radius = 178
  const dropped = pop(play, 12, { damping: 9, stiffness: 170, mass: 0.8 })
  const turn = frame * 1.2
  return (
    <div style={{ position: 'relative', height: 2 * radius + 10, display: 'grid', placeItems: 'center' }}>
      <svg width={2 * radius + 10} height={2 * radius + 10} viewBox={`${-radius - 5} ${-radius - 5} ${2 * radius + 10} ${2 * radius + 10}`}>
        <circle r={radius} fill={alpha(accent, 0.1)} stroke={alpha(theme.text, 0.35)} strokeWidth={3} />
        {/* Meridians: ellipses whose width follows the turn of the globe. */}
        {[0, 30, 60, 90, 120, 150].map((offset) => (
          <ellipse key={offset} rx={Math.abs(Math.cos(((turn + offset) * Math.PI) / 180)) * radius} ry={radius} fill="none" stroke={alpha(theme.text, 0.2)} strokeWidth={2} />
        ))}
        {[-0.6, -0.25, 0.25, 0.6].map((latitude) => (
          <line key={latitude} x1={-radius * Math.sqrt(1 - latitude ** 2)} x2={radius * Math.sqrt(1 - latitude ** 2)} y1={radius * latitude} y2={radius * latitude} stroke={alpha(theme.text, 0.2)} strokeWidth={2} />
        ))}
        {/* The ripple where the pin lands. */}
        <circle cx={40} cy={-20} r={ramp(frame, 20, 44) * 110} fill="none" stroke={alpha(accent, 0.8 * (1 - ramp(frame, 20, 44)))} strokeWidth={5} />
      </svg>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(${40 - 46}px, ${-20 - 92 - (1 - dropped) * 420}px)`, opacity: frame >= 12 ? 1 : 0 }}>
        <svg width={92} height={92} viewBox="0 0 24 24">
          <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.800 7 12 7 12z" fill={accent} stroke={theme.hardEdges ? theme.text : 'none'} strokeWidth={1.4} />
          <circle cx={12} cy={10} r={2.6} fill={onAccent} />
        </svg>
      </div>
      {items[0] && (
        <span
          style={{
            ...label(theme, 38, 650),
            position: 'absolute',
            left: '50%',
            bottom: 6,
            transform: `translateX(-50%) scale(${pop(play, 26)})`,
            padding: '10px 28px',
            borderRadius: 40,
            background: accent,
            color: onAccent,
          }}
        >
          {items[0]}
        </span>
      )}
    </div>
  )
}

/** Messages pop up, from one side then the other. */
const Chat = (play: Play) => {
  const { items, theme, accent, onAccent, frame } = play
  return (
    <div style={{ display: 'grid', gap: items.length > 3 ? 8 : 20 }}>
      {items.map((item, index) => {
        const at = 3 + index * 15
        const shown = pop(play, at + 7)
        const mine = index % 2 === 1
        const typing = frame >= at && frame < at + 7
        return (
          <div key={index} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', minHeight: items.length > 3 ? 80 : 84 }}>
            {typing ? (
              <span style={{ display: 'flex', gap: 10, padding: '30px 30px', borderRadius: 42, background: alpha(theme.text, 0.1) }}>
                {[0, 1, 2].map((dot) => (
                  <span key={dot} style={{ width: 18, height: 18, borderRadius: 9, background: alpha(theme.text, 0.3 + 0.5 * Math.abs(Math.sin((frame + dot * 3) / 3))) }} />
                ))}
              </span>
            ) : (
              <span
                style={{
                  ...label(theme, 40),
                  maxWidth: '86%',
                  padding: '20px 34px',
                  borderRadius: mine ? '42px 42px 10px 42px' : '42px 42px 42px 10px',
                  background: mine ? accent : alpha(theme.text, 0.1),
                  color: mine ? onAccent : theme.text,
                  opacity: frame >= at + 7 ? 1 : 0,
                  transform: `scale(${shown})`,
                  transformOrigin: mine ? '100% 100%' : '0 100%',
                }}
              >
                {item}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** A ranking: the first name starts last, and climbs to the top. */
const Leaderboard = (play: Play) => {
  const { items, theme, accent, onAccent, frame, fps } = play
  // The lines share the window's height: four are a little lower than three.
  const gap = 16
  const height = Math.min(96, (VIGNETTE.height - HEADER - PAD * 2 - gap * (items.length - 1)) / Math.max(1, items.length))
  const climbed = spring({ frame: frame - 18, fps, config: { damping: 14, stiffness: 110, mass: 0.9 } })
  const last = items.length - 1
  return (
    <div style={{ position: 'relative', height: items.length * (height + gap) }}>
      {items.map((item, index) => {
        // The winner goes from the last line to the first; the others each move down one.
        const from = index === 0 ? last : index - 1
        const place = from + (index - from) * climbed
        const winner = index === 0
        return (
          <div
            key={index}
            style={{
              ...row,
              position: 'absolute',
              left: 0,
              right: 0,
              top: place * (height + gap),
              height,
              padding: '0 30px',
              borderRadius: 28,
              background: winner ? accent : alpha(theme.text, 0.08),
              opacity: ramp(frame, index * 3, index * 3 + 6),
              zIndex: winner ? 1 : 0,
              boxShadow: winner && !theme.hardEdges ? `0 18px 60px ${alpha(accent, 0.4)}` : undefined,
            }}
          >
            <span style={{ ...label(theme, 40, 800), width: 54, color: winner ? onAccent : alpha(theme.text, 0.5), fontFamily: theme.display }}>{Math.round(place) + 1}</span>
            <span style={{ width: 58, height: 58, borderRadius: 29, flexShrink: 0, background: winner ? alpha(onAccent, 0.25) : alpha(theme.text, 0.16) }} />
            <span style={{ ...label(theme, 40, winner ? 700 : 600), flex: 1, color: winner ? onAccent : theme.text }}>{item}</span>
            <span style={{ width: 150 - Math.round(place) * 34, height: 14, borderRadius: 7, background: winner ? alpha(onAccent, 0.5) : alpha(theme.text, 0.2) }} />
          </div>
        )
      })}
    </div>
  )
}

/** A ring empties as the seconds go. */
const Timer = (play: Play) => {
  const { items, theme, accent, frame } = play
  const radius = 150
  const left = 1 - ramp(frame, 4, 110) * 0.72
  const seconds = Math.max(0, Math.ceil(30 * left - 8))
  return (
    <div style={{ ...row, justifyContent: 'center', gap: 60 }}>
      <svg width={340} height={340} viewBox="-170 -170 340 340" style={{ transform: `scale(${pop(play, 0)})` }}>
        <circle r={radius} fill="none" stroke={alpha(theme.text, 0.14)} strokeWidth={24} />
        <circle r={radius} fill="none" stroke={accent} strokeWidth={24} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - left} transform="rotate(-90)" />
        <text textAnchor="middle" dominantBaseline="central" fontFamily={theme.display} fontWeight={theme.displayWeight} fontSize={130} fill={theme.text} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {seconds}
        </text>
      </svg>
      {items[0] && <span style={{ ...label(theme, 46, 650), whiteSpace: 'normal', maxWidth: 380, opacity: ramp(frame, 8, 18) }}>{items[0]}</span>}
    </div>
  )
}

/** Settings switch on, one by one. */
const Toggles = (play: Play) => {
  const { items, theme, accent, onAccent, frame } = play
  // Four settings still fit in the window: they just sit closer together.
  const tight = items.length > 3
  return (
    <div style={{ display: 'grid', gap: tight ? 12 : 22 }}>
      {items.map((item, index) => {
        const shown = pop(play, 2 + index * 5)
        const on = pop(play, 18 + index * 11, { damping: 12, stiffness: 240, mass: 0.5 })
        const lit = frame >= 18 + index * 11
        return (
          <div key={index} style={{ ...row, justifyContent: 'space-between', padding: `${tight ? 6 : 18}px 30px`, borderRadius: 28, background: alpha(theme.text, 0.07), opacity: shown, transform: `translateY(${(1 - shown) * 30}px)` }}>
            <span style={label(theme)}>{item}</span>
            <span style={{ position: 'relative', width: 124, height: 68, borderRadius: 34, flexShrink: 0, background: lit ? accent : alpha(theme.text, 0.2) }}>
              <span style={{ position: 'absolute', top: 8, left: 8 + 56 * (lit ? on : 0), width: 52, height: 52, borderRadius: 26, background: lit ? onAccent : theme.text }} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** A text with hidden words: the bars lift, one by one. */
const Document = (play: Play) => {
  const { items, theme, accent, onAccent, frame } = play
  // Five lines of "words": blocks of uneven width, some of them hidden.
  const lines = [
    [150, 'x', 210, 120],
    [240, 130, 'x', 90],
    ['x', 180, 150, 110],
    [130, 220, 100, 'x'],
    [200, 140, 180],
  ] as const
  let hidden = -1
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} style={{ display: 'flex', gap: 16, alignItems: 'center', height: 56, opacity: ramp(frame, lineIndex * 2, lineIndex * 2 + 6) }}>
          {line.map((word, wordIndex) => {
            if (word !== 'x') return <span key={wordIndex} style={{ width: word, height: 20, borderRadius: 10, background: alpha(theme.text, 0.2) }} />
            hidden += 1
            const text = items[hidden]
            const liftAt = 14 + hidden * 12
            const lifted = text ? easeOut(ramp(frame, liftAt, liftAt + 8)) : 0
            return (
              <span key={wordIndex} style={{ position: 'relative', height: 56, minWidth: 170, display: 'grid', alignItems: 'center' }}>
                <span style={{ ...label(theme, 36, 700), padding: '0 18px', color: onAccent, background: accent, borderRadius: 10, lineHeight: '56px', opacity: lifted }}>{text ?? ''}</span>
                {/* The bar that hides the word, sliding off to the right. */}
                <span style={{ position: 'absolute', inset: 0, borderRadius: 8, background: theme.text, transformOrigin: '100% 50%', transform: `scaleX(${1 - lifted})` }} />
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** A link is copied, and people join. */
const Share = (play: Play) => {
  const { items, theme, accent, onAccent, frame } = play
  const copied = pop(play, 16, { damping: 10, stiffness: 220, mass: 0.5 })
  const names = items.slice(1).length > 0 ? items.slice(1) : ['', '', '']
  return (
    <div style={{ display: 'grid', gap: 36, justifyItems: 'center' }}>
      <div style={{ ...row, position: 'relative', height: 104, padding: '0 36px', borderRadius: 52, background: alpha(theme.text, 0.08), border: `3px solid ${alpha(theme.text, 0.2)}`, transform: `scale(${pop(play, 0)})` }}>
        <Icon name="share" size={46} color={accent} at={-99} />
        <span style={label(theme, 42)}>{items[0] ?? 'lien'}</span>
        {/* The tick that says the link was copied. */}
        <span style={{ position: 'absolute', right: -26, top: -30, width: 72, height: 72, borderRadius: 36, display: 'grid', placeItems: 'center', background: accent, transform: `scale(${frame >= 16 ? copied : 0}) rotate(6deg)` }}>
          <svg viewBox="0 0 24 24" width={44} height={44} fill="none" stroke={onAccent} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 22 }}>
        {names.map((name, index) => {
          const joined = pop(play, 24 + index * 6, { damping: 9, stiffness: 200, mass: 0.6 })
          return (
            <div key={index} style={{ display: 'grid', gap: 10, justifyItems: 'center', transform: `scale(${joined})` }}>
              <span
                style={{
                  ...label(theme, 44, 800),
                  width: 108,
                  height: 108,
                  borderRadius: 54,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: theme.display,
                  background: index === 0 ? accent : alpha(theme.text, 0.14),
                  color: index === 0 ? onAccent : theme.text,
                }}
              >
                {[...name][0]?.toUpperCase() ?? ''}
              </span>
              {name && <span style={{ ...label(theme, 30), maxWidth: 190, opacity: 0.8 }}>{name}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Cards fan out from a stack. */
const Cards = (play: Play) => {
  const { items, theme, accent, onAccent } = play
  const titles = items.length > 0 ? items : ['', '', '']
  const middle = (titles.length - 1) / 2
  return (
    <div style={{ position: 'relative', height: 360, display: 'grid', placeItems: 'center' }}>
      {titles.map((title, index) => {
        const fanned = pop(play, 3 + index * 4, { damping: 12, stiffness: 130, mass: 0.8 })
        const offset = index - middle
        const front = index === Math.round(middle)
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              width: 300,
              height: 320,
              padding: 28,
              borderRadius: 34,
              display: 'grid',
              alignContent: 'space-between',
              background: front ? accent : mix(theme.bg, theme.text, 0.16),
              border: theme.hardEdges ? `6px solid ${theme.text}` : `2px solid ${alpha(theme.text, 0.2)}`,
              boxShadow: theme.hardEdges ? `10px 10px 0 ${theme.text}` : `0 24px 60px ${alpha('#000000', 0.35)}`,
              transform: `translateX(${offset * 250 * fanned}px) rotate(${offset * 9 * fanned}deg) scale(${0.8 + 0.2 * fanned})`,
              zIndex: front ? 2 : 1,
            }}
          >
            <span style={{ width: 70, height: 70, borderRadius: 22, background: front ? alpha(onAccent, 0.22) : alpha(theme.text, 0.14) }} />
            <span style={{ ...label(theme, 36, 700), whiteSpace: 'normal', color: front ? onAccent : theme.text }}>{title}</span>
          </div>
        )
      })}
    </div>
  )
}

const INTERFACES: Record<string, (play: Play) => ReactNode> = {
  search: Search,
  checklist: Checklist,
  chart: Chart,
  counter: Counter,
  map: Map,
  chat: Chat,
  leaderboard: Leaderboard,
  timer: Timer,
  toggles: Toggles,
  document: Document,
  share: Share,
  cards: Cards,
}

/**
 * A feature shown as a small interface in motion, in a window of its own: what the
 * viewer would see happen in the product, rather than a pictogram standing for it.
 */
export const Vignette = ({ visual, icon, theme, accent, at }: VignetteProps) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - at
  const Interface = INTERFACES[visual.type] ?? Cards
  const opened = spring({ frame: local, fps, config: { damping: 14, stiffness: 140, mass: 0.8 } })
  // The window floats: it tilts a little as it arrives, then keeps drifting.
  const tilt = (1 - opened) * 22 + Math.sin(frame / 22) * 2.2
  const panel = mix(theme.bg, theme.text, 0.075)

  return (
    <div style={{ perspective: 2200, width: VIGNETTE.width, height: VIGNETTE.height }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 46,
          overflow: 'hidden',
          background: panel,
          border: theme.hardEdges ? `7px solid ${theme.text}` : `2px solid ${alpha(theme.text, 0.16)}`,
          boxShadow: theme.hardEdges ? `16px 16px 0 ${theme.text}` : `0 40px 110px ${alpha('#000000', 0.45)}, 0 0 150px ${alpha(accent, theme.backdrop === 'glow' || theme.textGlow ? 0.22 : 0)}`,
          opacity: interpolate(local, [0, 4], [0, 1], clampOpts),
          transform: `translateY(${(1 - opened) * 120}px) rotateX(${tilt * 0.5}deg) rotateY(${-tilt}deg) scale(${0.86 + 0.14 * opened})`,
          transformOrigin: '50% 60%',
        }}
      >
        {/* The window's bar: what the feature is, and the bones of a toolbar. */}
        <div style={{ ...row, height: HEADER, padding: `0 ${PAD - 8}px`, borderBottom: `2px solid ${alpha(theme.text, 0.1)}` }}>
          <span style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', background: alpha(accent, theme.hardEdges ? 1 : 0.18) }}>
            <Icon name={icon} size={34} color={theme.hardEdges ? inkOn(theme, accent) : accent} at={at + 4} strokeWidth={2} />
          </span>
          <span style={{ width: 190, height: 14, borderRadius: 7, background: alpha(theme.text, 0.2) }} />
          <span style={{ flex: 1 }} />
          <span style={{ width: 70, height: 14, borderRadius: 7, background: alpha(theme.text, 0.12) }} />
          <span style={{ width: 40, height: 14, borderRadius: 7, background: alpha(theme.text, 0.12) }} />
        </div>
        <div style={{ height: VIGNETTE.height - HEADER, padding: PAD, display: 'grid', alignContent: 'center' }}>
          {Interface({ items: visual.items, theme, accent, onAccent: inkOn(theme, accent), frame: local - 6, fps })}
        </div>
      </div>
    </div>
  )
}
