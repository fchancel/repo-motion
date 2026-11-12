import type { Theme } from '../theme'
import type { TextStyle } from '../text'
import type { VideoProps } from '../types'

/** What every shot receives. */
export interface ShotProps {
  theme: Theme
  video: VideoProps
  /** How long the shot lasts, in frames. */
  frames: number
  /** Frames during which the previous shot is still leaving: nothing important starts before. */
  enter: number
}

/** `weight`: for secondary lines, lighter than the look's own display weight. */
export const displayStyle = (theme: Theme, weight?: number): TextStyle => ({
  fontFamily: theme.display,
  fontWeight: Math.min(weight ?? theme.displayWeight, theme.displayWeight),
  fontStretch: theme.displayStretch,
  letterSpacing: theme.tracking,
  uppercase: theme.uppercase,
})

export const bodyStyle = (theme: Theme, weight = 600): TextStyle => ({
  fontFamily: theme.body,
  fontWeight: weight,
  letterSpacing: -0.01,
})

export { clamp, staggerFor } from '../timing.ts'
