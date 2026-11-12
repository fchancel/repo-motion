import { describe, expect, it } from 'vitest'
import { aPersonaDraft, aProductBriefDraft } from '../../testing/fixtures'
import { ProductBrief } from '../analysis/product-brief'
import { Personas, type Persona } from './persona'

const brief = (() => {
  const created = ProductBrief.create(aProductBriefDraft())
  if (!created.ok) throw new Error('fixture')
  return created.value
})()

const two = [aPersonaDraft(), aPersonaDraft({ name: 'Marc', audience: 'Amateurs de quiz' })]
const violationsOf = (result: ReturnType<typeof Personas.create>) => (result.ok ? [] : result.error.violations)

describe('Personas.create', () => {
  it('accepts distinct personas that fit the brief', () => {
    const personas = Personas.create(two, brief)
    expect(personas.ok && personas.value.all.map((persona) => persona.name)).toEqual(['Léa', 'Marc'])
  })

  it('needs at least two, to have someone to compare with', () => {
    expect(violationsOf(Personas.create([aPersonaDraft()], brief))).toEqual(['Il faut entre 2 et 5 personas, il y en a 1.'])
  })

  it('refuses two personas with the same first name', () => {
    expect(violationsOf(Personas.create([aPersonaDraft(), aPersonaDraft({ name: ' léa ' })], brief))).toContain(
      'Deux personas portent le même prénom.',
    )
  })

  it('only accepts features that exist in the brief', () => {
    const invented = aPersonaDraft({ name: 'Marc', keyFeatures: ['Mode multijoueur'] })
    expect(violationsOf(Personas.create([aPersonaDraft(), invented], brief))).toEqual([
      "personas[1].keyFeatures : « Mode multijoueur » n'est pas une fonctionnalité du brief.",
    ])
  })

  it('keeps hooks short enough to be read in two seconds', () => {
    const long = aPersonaDraft({ name: 'Marc', hook: 'x'.repeat(81) })
    expect(violationsOf(Personas.create([aPersonaDraft(), long], brief))).toEqual(['personas[1].hook dépasse 80 caractères (81).'])
  })

  it('refuses unknown channels', () => {
    const snapchat = aPersonaDraft({ name: 'Marc', channels: ['tiktok', 'snapchat'] })
    expect(violationsOf(Personas.create([aPersonaDraft(), snapchat], brief))[0]).toContain('channels')
  })

  it('needs a short explanation of why each persona exists', () => {
    const silent = aPersonaDraft({ name: 'Marc', rationale: ' ' })
    const rambling = aPersonaDraft({ name: 'Zoé', rationale: 'x'.repeat(321) })
    expect(violationsOf(Personas.create([aPersonaDraft(), silent, rambling], brief))).toEqual([
      'personas[1].rationale est vide.',
      'personas[2].rationale dépasse 320 caractères (321).',
    ])
  })

  it('reports every problem at once, so the model can fix them in one pass', () => {
    const broken = aPersonaDraft({ name: 'Marc', role: ' ', pains: [], channels: [] })
    expect(violationsOf(Personas.create([aPersonaDraft(), broken], brief))).toHaveLength(3)
  })
})

describe('Personas.restore', () => {
  it('reads personas written before they explained themselves', () => {
    const { rationale: _, ...old } = { ...aPersonaDraft(), channels: ['tiktok' as const] }
    const restored = Personas.restore([old as unknown as Persona])
    expect(restored.all[0]?.rationale).toBeNull()
  })
})
