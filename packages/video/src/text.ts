import { useMemo } from 'react'
import { tokenize, type Token } from './words'

export { countWords, tokenize, type Token } from './words'

export interface TextStyle {
  fontFamily: string
  fontWeight: number
  fontStretch?: string
  /** In em. */
  letterSpacing?: number
  /** Set in capitals: the words are measured, and drawn, in capitals. */
  uppercase?: boolean
}

const REFERENCE = 200
const widths = new Map<string, number>()
let ruler: HTMLSpanElement | null = null

/** Width of a word in em, measured in the browser with the real font. */
const measure = (text: string, style: TextStyle): number => {
  const key = `${style.fontFamily}|${style.fontWeight}|${style.fontStretch ?? ''}|${style.letterSpacing ?? 0}|${text}`
  const known = widths.get(key)
  if (known !== undefined) return known

  if (!ruler) {
    ruler = document.createElement('span')
    Object.assign(ruler.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', left: '-99999px', top: '0' })
    document.body.appendChild(ruler)
  }
  Object.assign(ruler.style, {
    fontFamily: style.fontFamily,
    fontWeight: String(style.fontWeight),
    fontStretch: style.fontStretch ?? 'normal',
    letterSpacing: `${style.letterSpacing ?? 0}em`,
    fontSize: `${REFERENCE}px`,
  })
  ruler.textContent = text
  const width = ruler.getBoundingClientRect().width / REFERENCE
  widths.set(key, width)
  return width
}

export interface FitOptions {
  width: number
  height: number
  /** The size used when the text is short enough. */
  max: number
  /** Never smaller, even if the text then overflows. */
  min: number
  lineHeight?: number
  /** Space between words, in em. */
  gap?: number
}

export interface Fitted {
  /** Font size in pixels. */
  size: number
  lines: Token[][]
  lineHeight: number
  gap: number
  /** Height of the whole block in pixels. */
  height: number
  style: TextStyle
}

const ENDS_SENTENCE = /[.?!…]$/

/** Where each sentence starts and stops among the tokens, as [from, to) pairs. */
const sentences = (tokens: Token[]): [number, number][] => {
  const ranges: [number, number][] = []
  let from = 0
  tokens.forEach((token, index) => {
    if (ENDS_SENTENCE.test(token.text) || index === tokens.length - 1) {
      ranges.push([from, index + 1])
      from = index + 1
    }
  })
  return ranges
}

/** Greedy wrapping, in em. Null when a single word is wider than the line. */
const wrap = (tokens: Token[], sizes: number[], limit: number, gap: number): Token[][] | null => {
  const lines: Token[][] = []
  let line: Token[] = []
  let used = 0

  for (const [index, token] of tokens.entries()) {
    const width = sizes[index] ?? 0
    if (width > limit) return null
    const next = line.length === 0 ? width : used + gap + width
    if (next > limit && line.length > 0) {
      lines.push(line)
      line = [token]
      used = width
    } else {
      line.push(token)
      used = next
    }
  }
  if (line.length > 0) lines.push(line)
  return lines
}

/** Each sentence wrapped on its own lines, as narrow as it can be without adding a line. */
const wrapBySentence = (tokens: Token[], sizes: number[], limit: number, gap: number): Token[][] | null => {
  const lines: Token[][] = []
  for (const [from, to] of sentences(tokens)) {
    const [words, widths] = [tokens.slice(from, to), sizes.slice(from, to)]
    const natural = wrap(words, widths, limit, gap)
    if (!natural) return null

    let [narrow, wide] = [Math.max(...widths, 0), limit]
    let balanced = natural
    for (let step = 0; step < 12; step += 1) {
      const middle = (narrow + wide) / 2
      const candidate = wrap(words, widths, middle, gap)
      if (candidate && candidate.length <= natural.length) {
        wide = middle
        balanced = candidate
      } else narrow = middle
    }
    lines.push(...balanced)
  }
  return lines
}

/** How much smaller the type may get so that no line straddles two sentences. */
const SENTENCE_BREAK_COST = 0.84

/**
 * The biggest type that fits the box, with lines of even length: big type is what makes a
 * short video readable on a phone, and a lone word on the last line is what makes it look amateur.
 * When it costs little, lines also break where sentences end, the way the text is said aloud.
 */
export const fit = (text: string, style: TextStyle, options: FitOptions): Fitted => {
  const tokens = tokenize(text).map((token) => (style.uppercase ? { ...token, text: token.text.toUpperCase() } : token))
  const sizes = tokens.map((token) => measure(token.text, style))
  const free = fitWith(tokens, sizes, style, options, (limit, gap) => wrap(tokens, sizes, limit, gap))
  if (sentences(tokens).length < 2) return free

  const spoken = fitWith(tokens, sizes, style, options, (limit, gap) => wrapBySentence(tokens, sizes, limit, gap), false)
  return spoken.fits && spoken.size >= free.size * SENTENCE_BREAK_COST ? spoken : free
}

const fitWith = (
  tokens: Token[],
  sizes: number[],
  style: TextStyle,
  options: FitOptions,
  wrapAt: (limit: number, gap: number) => Token[][] | null,
  balance = true,
): Fitted & { fits: boolean } => {
  const { width, height, max, min, lineHeight = 1.04, gap = 0.24 } = options

  const linesAt = (size: number) => {
    const lines = wrapAt(width / size, gap)
    return lines && lines.length * lineHeight * size <= height ? lines : null
  }

  let size = min
  if (linesAt(max)) size = max
  else if (linesAt(min)) {
    let [low, high] = [min, max]
    for (let step = 0; step < 14; step += 1) {
      const middle = (low + high) / 2
      if (linesAt(middle)) low = middle
      else high = middle
    }
    size = Math.floor(low)
  }

  const fits = linesAt(size) !== null
  const natural = wrapAt(width / size, gap) ?? tokens.map((token) => [token])

  // Same number of lines, but as narrow as possible: the lines even out.
  let lines = natural
  if (balance) {
    let [narrow, wide] = [Math.max(...sizes, 0), width / size]
    for (let step = 0; step < 14; step += 1) {
      const middle = (narrow + wide) / 2
      const candidate = wrapAt(middle, gap)
      if (candidate && candidate.length <= natural.length) {
        wide = middle
        lines = candidate
      } else narrow = middle
    }
  }

  return { size, lines, lineHeight, gap, height: lines.length * lineHeight * size, style, fits }
}

export const useFit = (text: string, style: TextStyle, options: FitOptions): Fitted =>
  useMemo(
    () => fit(text, style, options),
    [text, style.fontFamily, style.fontWeight, style.fontStretch, style.uppercase, options.width, options.height, options.max, options.min],
  )

/** The same texts set at one size: the smallest any of them needs. */
export const fitTogether = (texts: string[], style: TextStyle, options: FitOptions): Fitted[] => {
  const size = Math.min(...texts.map((text) => fit(text, style, options).size))
  return texts.map((text) => fit(text, style, { ...options, max: size, min: size }))
}

