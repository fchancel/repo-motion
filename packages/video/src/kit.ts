// What a video directed by Claude may build with, besides Remotion itself. Everything here
// is optional: a piece can draw everything on its own. See studio/GUIDE.md.
export { FPS, HEIGHT, SAFE, SAFE_HEIGHT, SAFE_WIDTH, WIDTH, type BrandColors, type Look, type PieceProps } from './types'
export { accentAt, alpha, contrast, inkOn, luminance, makeTheme, mix, type Theme } from './theme'
export { ThemeProvider, emphasize, useTheme } from './look'
export { fit, fitTogether, useFit, type Fitted, type FitOptions, type TextStyle } from './text'
export { tokenize } from './words'
export { Words, type Emphasis } from './components/Words'
export { Stage, Flood } from './components/Stage'
export { Icon } from './components/Icon'
export { LogoTile } from './components/LogoTile'
export { Phone, phoneSize } from './components/Phone'
export { Vignette, VIGNETTE } from './scenes/Vignette'
export { bodyStyle, displayStyle } from './scenes/shared'
