import { useEffect, useState } from 'react'
import { continueRender, delayRender, Img } from 'remotion'
import { alpha, luminance, type Theme } from '../theme'

interface LogoLook {
  /** The image fills its square: it already is an app icon. */
  fills: boolean
  /** The drawing itself is light, so it needs a dark tile behind it. */
  light: boolean
}

const looks = new Map<string, Promise<LogoLook>>()

/** Looks at the logo's pixels: a logo may be anything, and must stay visible on its tile. */
const inspect = (src: string): Promise<LogoLook> => {
  const known = looks.get(src)
  if (known) return known

  const look = new Promise<LogoLook>((resolve) => {
    const image = new Image()
    image.onload = () => {
      const side = 48
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = side
      const context = canvas.getContext('2d')
      if (!context) return resolve({ fills: false, light: false })
      context.drawImage(image, 0, 0, side, side)

      const { data } = context.getImageData(0, 0, side, side)
      let [opaque, light] = [0, 0]
      for (let offset = 0; offset < data.length; offset += 4) {
        const visible = (data[offset + 3] ?? 0) / 255
        opaque += visible
        light += visible * ((0.2126 * (data[offset] ?? 0) + 0.7152 * (data[offset + 1] ?? 0) + 0.0722 * (data[offset + 2] ?? 0)) / 255)
      }
      resolve({ fills: opaque / (side * side) > 0.92, light: opaque > 0 && light / opaque > 0.5 })
    }
    image.onerror = () => resolve({ fills: false, light: false })
    image.src = src
  })
  looks.set(src, look)
  return look
}

interface LogoTileProps {
  theme: Theme
  logo: string | null
  /** Shown as an initial when there is no logo. */
  name: string
  size: number
}

/** The product's logo on an app-icon tile. Without a logo, the product's initial. */
export const LogoTile = ({ theme, logo, name, size }: LogoTileProps) => {
  const [look, setLook] = useState<LogoLook | null>(null)
  const [handle] = useState(() => delayRender('Inspecting the logo'))

  useEffect(() => {
    if (!logo) return continueRender(handle)
    void inspect(logo).then((result) => {
      setLook(result)
      continueRender(handle)
    })
  }, [logo, handle])

  const dark = luminance(theme.bg) < 0.4 ? theme.bg : '#0b0b10'
  const tile = !logo ? dark : look?.light ? dark : '#ffffff'
  const radius = size * 0.235

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: tile,
        boxShadow: `0 ${size * 0.1}px ${size * 0.3}px ${alpha('#000000', 0.32)}, inset 0 0 0 ${Math.max(2, size * 0.012)}px ${alpha('#ffffff', 0.14)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {logo && look && (
        <Img src={logo} style={{ width: look.fills ? '100%' : '66%', height: look.fills ? '100%' : '66%', objectFit: 'contain' }} />
      )}
      {!logo && (
        <span style={{ fontFamily: theme.display, fontWeight: 800, fontSize: size * 0.56, lineHeight: 1, color: theme.primary }}>
          {[...name][0]?.toUpperCase()}
        </span>
      )}
    </div>
  )
}
