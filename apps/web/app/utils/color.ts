/** WCAG relative luminance of a `#rrggbb` colour. */
const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Black or white, whichever reads best on top of `hex`. */
export const readableOn = (hex: string): string => (luminance(hex) > 0.36 ? '#15172e' : '#ffffff')
