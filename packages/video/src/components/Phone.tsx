import { useEffect, useState } from 'react'
import { continueRender, delayRender, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { alpha } from '../theme'

const BEZEL = 15

/** How tall each picture is once it fills the phone's width. */
const useHeights = (screens: string[], width: number): number[] | null => {
  const [heights, setHeights] = useState<number[] | null>(null)
  const [handle] = useState(() => delayRender('Measuring the screens'))

  useEffect(() => {
    const measure = (src: string) =>
      new Promise<number>((resolve) => {
        const image = new Image()
        image.onload = () => resolve((image.naturalHeight / image.naturalWidth) * width)
        image.onerror = () => resolve((width * 844) / 390)
        image.src = src
      })
    void Promise.all(screens.map(measure)).then((measured) => {
      setHeights(measured)
      continueRender(handle)
    })
  }, [screens, width, handle])

  return heights
}

interface PhoneProps {
  /** Pictures of the application, as tall as its pages: each one is scrolled through. */
  screens: string[]
  /** Frame at which the phone arrives. */
  at: number
  /** How many frames the phone has to show all its screens, from `at`. */
  frames: number
  /** Width of the screen, in the frame's pixels. The phone is a little wider. */
  width?: number
  /** The colour of the halo behind the phone. None: no halo. */
  glow?: string | undefined
}

/** The size the phone takes in the layout, for a screen of that width. */
export const phoneSize = (width = 476) => ({ width: width + BEZEL * 2, height: Math.round((width * 844) / 390) + BEZEL * 2 })

/**
 * The real application, in a phone: each page scrolls the way a thumb would scroll it,
 * and gives way to the next.
 */
export const Phone = ({ screens, at, frames, width = 476, glow }: PhoneProps) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const height = Math.round((width * 844) / 390)
  const heights = useHeights(screens, width)
  const arrived = spring({ frame: frame - at, fps, config: { damping: 16, stiffness: 120, mass: 0.9 } })

  // Each page gets the same share of the time.
  const count = Math.max(1, screens.length)
  const share = frames / count
  const current = Math.min(count - 1, Math.max(0, Math.floor((frame - at) / share)))

  return (
    <div style={{ perspective: 2400, transform: `translateY(${(1 - arrived) * 900}px)` }}>
      <div
        style={{
          padding: BEZEL,
          borderRadius: width * 0.164,
          background: '#0b0b10',
          boxShadow: `0 0 0 3px ${alpha('#ffffff', 0.16)}, 0 60px 140px ${alpha('#000000', 0.55)}${glow ? `, 0 0 160px ${alpha(glow, 0.3)}` : ''}`,
          transform: `rotateY(${interpolate(frame, [at, at + frames], [-13, 5])}deg) rotateX(${4 - arrived * 2}deg)`,
        }}
      >
        <div style={{ position: 'relative', width, height, borderRadius: width * 0.134, overflow: 'hidden', background: '#000000' }}>
          {heights &&
            screens.map((screen, index) => {
              const local = frame - at - index * share
              // A pause at the top, then one long scroll, as far as the page goes.
              const scrolled = interpolate(local, [share * 0.22, share * 0.92], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.inOut(Easing.cubic),
              })
              const travel = Math.max(0, (heights[index] ?? height) - height)
              const slideIn = index === 0 ? 1 : spring({ frame: local, fps, config: { damping: 200, stiffness: 170 } })
              if (index > current || index < current - 1) return null

              return (
                <Img
                  key={index}
                  src={screen}
                  style={{ position: 'absolute', left: 0, top: 0, width, transform: `translate(${(1 - slideIn) * width}px, ${-scrolled * travel}px)` }}
                />
              )
            })}
          {/* The camera's island, as on a real phone. */}
          <div style={{ position: 'absolute', left: '50%', top: 16, width: width * 0.277, height: width * 0.08, marginLeft: -width * 0.1385, borderRadius: width * 0.04, background: '#000000' }} />
        </div>
      </div>
    </div>
  )
}
