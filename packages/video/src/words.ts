// Pure: no React, no browser. The render script reads this file too, to time the sound.

/** A word as it is animated: one unit that appears at once. */
export interface Token {
  text: string
  /** Wrapped in *asterisks* by the storyboard: the video highlights it. */
  emphasis: boolean
}

const NBSP = ' '
const CLOSING = /^[?!:;»%]+$/
const OPENING = /^[«]+$/

/**
 * Splits a text into words, reading the `*emphasis*` markers. French puts a space before
 * `?`, `!` and `:`: those stay glued to their word, so a lone `?` never starts a line.
 */
export const tokenize = (text: string): Token[] => {
  const raw: Token[] = []
  let current = ''
  let currentEmphasis = false
  let emphasis = false

  const push = () => {
    if (current) raw.push({ text: current, emphasis: currentEmphasis })
    current = ''
    currentEmphasis = false
  }

  for (const character of text) {
    if (character === '*') emphasis = !emphasis
    else if (/\s/.test(character)) push()
    else {
      current += character
      currentEmphasis ||= emphasis
    }
  }
  push()

  const tokens: Token[] = []
  let prefix = ''
  for (const token of raw) {
    const previous = tokens.at(-1)
    // "5 000" is one number: its groups are never split across two lines.
    const sameNumber = previous !== undefined && /\d$/.test(previous.text) && /^\d{3}(\D|$)/.test(token.text)
    if ((CLOSING.test(token.text) || sameNumber) && previous) previous.text += NBSP + token.text
    else if (OPENING.test(token.text)) prefix = token.text + NBSP
    else {
      tokens.push({ ...token, text: prefix + token.text })
      prefix = ''
    }
  }
  return tokens
}

export const countWords = (text: string): number => tokenize(text).length
