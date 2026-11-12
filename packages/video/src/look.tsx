import { createContext, useContext } from 'react'
import type { Emphasis } from './components/Words'
import { contrast, inkOn, type Theme } from './theme'

/** The theme of the shot being drawn: shared building blocks read the look's traits from it. */
const ThemeContext = createContext<Theme | null>(null)

export const ThemeProvider = ThemeContext.Provider

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('No theme: shots must be drawn inside a ThemeProvider.')
  return theme
}

/**
 * How the words that matter stand out. Each shot asks for the treatment it has in the
 * brand look; the other looks answer in their own way.
 */
export const emphasize = (theme: Theme, wanted: 'box' | 'color' | 'underline', accent: string): Emphasis => {
  const box: Emphasis = { type: 'box', background: accent, color: inkOn(theme, accent) }
  // A colour that does not stand out on this shot's background cannot carry a word alone.
  const legible = contrast(accent, theme.bg) >= 3

  switch (theme.emphasis) {
    case 'box':
      return box
    case 'sticker':
      return { type: 'sticker', background: accent, color: inkOn(theme, accent), outline: theme.text }
    case 'shadow':
      return { type: 'shadow', color: legible ? accent : theme.text, shadow: legible ? theme.text : accent }
    case 'glow':
      return { type: 'glow', color: accent }
    case 'italic':
      return { type: 'italic', color: accent }
    case 'quiet':
      return wanted === 'color' && legible ? { type: 'color', color: accent } : { type: 'underline', color: legible ? accent : theme.text }
    case 'auto':
      return wanted === 'box' || !legible ? box : { type: wanted, color: accent }
  }
}

/** For small text read word by word: never a block, which would hide what is being read. */
export const emphasizeQuietly = (theme: Theme, accent: string): Emphasis =>
  contrast(accent, theme.bg) >= 3 && theme.emphasis !== 'box' ? { type: 'color', color: accent } : { type: 'underline', color: theme.text }

/** A size of the brand look, as this look sets it. */
export const sized = (theme: Theme, size: number): number => Math.round(size * theme.scale)
