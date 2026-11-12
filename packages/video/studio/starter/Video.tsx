// The piece. Replace everything below: this is only the smallest thing that renders.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { SAFE, makeTheme, type PieceProps } from '@kit'

/** How long the video lasts. */
export const DURATION_SECONDS = 20

export default function Video(piece: PieceProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = makeTheme(piece.colors, piece.fonts, piece.look)
  const arrived = spring({ frame, fps, config: { damping: 14 } })

  return (
    <AbsoluteFill style={{ background: theme.bg, padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`, justifyContent: 'center' }}>
      <div
        style={{
          fontFamily: theme.display,
          fontWeight: 800,
          fontSize: 150,
          lineHeight: 1,
          color: theme.text,
          opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `translateY(${(1 - arrived) * 80}px)`,
        }}
      >
        {piece.product.name}
      </div>
    </AbsoluteFill>
  )
}
