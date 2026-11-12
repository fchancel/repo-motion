import type { Brand } from '../../shared/brand'

export type HexColor = Brand<string, '#rrggbb'>

const LONG = /^#?([0-9a-f]{6})$/i
const SHORT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i

/** Normalises `#ABC`, `abc`, `#AABBCC` to `#aabbcc`. Returns `null` when the input is not a colour. */
export const parseHexColor = (input: string): HexColor | null => {
  const value = input.trim()
  const long = LONG.exec(value)
  if (long?.[1]) return `#${long[1].toLowerCase()}` as HexColor

  const short = SHORT.exec(value)
  if (short?.[1] && short[2] && short[3]) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase() as HexColor
  }
  return null
}
