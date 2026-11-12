import { describe, expect, it } from 'vitest'
import { aProductBriefDraft } from '../../testing/fixtures'
import { ProductBrief } from './product-brief'

const violationsOf = (result: ReturnType<typeof ProductBrief.create>) => (result.ok ? [] : result.error.violations)

describe('ProductBrief.create', () => {
  it('normalises the brand palette', () => {
    const result = ProductBrief.create(aProductBriefDraft())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.props.brand.colors).toEqual({
      primary: '#1e40af',
      secondary: null,
      accent: '#f59e0b',
      background: null,
      text: null,
    })
  })

  it('requires at least one core feature', () => {
    const draft = aProductBriefDraft()
    const features = draft.features.map((feature) => ({ ...feature, importance: 'secondary' as const }))

    expect(violationsOf(ProductBrief.create({ ...draft, features }))).toContain(
      'Au moins une feature doit être marquée "core".',
    )
  })

  it('rejects colours that are not hexadecimal', () => {
    const draft = aProductBriefDraft()
    const brand = { ...draft.brand, colors: { primary: 'blue', text: 'rgb(0,0,0)' } }

    expect(violationsOf(ProductBrief.create({ ...draft, brand }))).toHaveLength(2)
  })

  it('reports every violation at once, so the model can fix them in one pass', () => {
    const result = ProductBrief.create(aProductBriefDraft({ productName: ' ', audiences: [], tagline: 'x'.repeat(121) }))

    expect(violationsOf(result)).toEqual([
      'productName est vide.',
      'tagline dépasse 120 caractères.',
      'audiences doit contenir entre 1 et 6 éléments.',
    ])
  })
})
