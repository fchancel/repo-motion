import { aProductBriefDraft } from '@repo-motion/core/testing'
import { describe, expect, it } from 'vitest'
import { extractJson } from './claude-prompt-runner'
import { readProductBrief } from './product-brief-document'

const problemsOf = (result: ReturnType<typeof readProductBrief>) => (result.ok ? null : result.error.problems)

describe('readProductBrief', () => {
  it('turns the answer into a ProductBrief', () => {
    const result = readProductBrief(aProductBriefDraft())
    expect(result.ok && result.value.props.productName).toBe('Wiki Géo')
  })

  it('accepts missing optional fields', () => {
    const draft = aProductBriefDraft()
    const result = readProductBrief({ ...draft, brand: { ...draft.brand, logoPath: undefined } })
    expect(result.ok && result.value.props.brand.logoPath).toBeNull()
  })

  it('reports the fields with the wrong shape', () => {
    const { features: _removed, ...withoutFeatures } = aProductBriefDraft()
    expect(problemsOf(readProductBrief(withoutFeatures))).toContain('features')
  })

  it('applies the domain rules after the shape check', () => {
    const draft = aProductBriefDraft()
    const answer = { ...draft, brand: { ...draft.brand, colors: { primary: 'bleu' } } }
    expect(problemsOf(readProductBrief(answer))).toContain('couleur hexadécimale')
  })

  it('rejects an answer with no JSON at all', () => {
    expect(problemsOf(readProductBrief(extractJson('Je ne peux pas analyser ce dossier.')))).toContain('JSON')
  })
})

describe('extractJson', () => {
  it.each([
    ['{"a":1}', { a: 1 }],
    ['```json\n{"a":1}\n```', { a: 1 }],
    ['Voici le brief :\n{"a":{"b":2}}\nBonne lecture.', { a: { b: 2 } }],
  ])('finds the object in %j', (text, expected) => {
    expect(extractJson(text)).toEqual(expected)
  })

  it('gives up on broken JSON', () => {
    expect(extractJson('{"a":')).toBeUndefined()
  })
})
