import { useEffect, useState } from 'react'
import { continueRender, delayRender } from 'remotion'
import type { FontSpec } from './types'

const loading = new Map<string, Promise<unknown>>()

const load = (spec: FontSpec): Promise<unknown> => {
  const known = loading.get(spec.family)
  if (known) return known

  const faces = spec.faces.map((face) => {
    const font = new FontFace(spec.family, `url(${face.src}) format('woff2')`, {
      weight: face.weight,
      ...(face.style ? { style: face.style } : {}),
      ...(face.stretch ? { stretch: face.stretch } : {}),
      ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}),
    })
    document.fonts.add(font)
    return font.load()
  })
  const all = Promise.all(faces)
  loading.set(spec.family, all)
  return all
}

/**
 * Registers the video's typefaces and holds the render until they are usable: text is
 * measured to be fitted, and measuring with a fallback font would size everything wrong.
 */
export const useFonts = (fonts: FontSpec[]): boolean => {
  const [ready, setReady] = useState(false)
  const [handle] = useState(() => delayRender('Loading fonts'))

  useEffect(() => {
    // A font that fails to load falls back to the system's: better than no video.
    Promise.allSettled(fonts.map(load)).then(() => {
      setReady(true)
      continueRender(handle)
    })
  }, [])

  return ready
}
