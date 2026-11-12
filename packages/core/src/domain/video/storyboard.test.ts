import { describe, expect, it } from 'vitest'
import { aPersonaDraft, aProductBriefDraft, aStoryboardDraft } from '../../testing'
import { ProductBrief } from '../analysis/product-brief'
import { Personas } from '../persona/persona'
import { plainText, sceneSeconds, Storyboard, type Scene, type StoryboardDraft } from './storyboard'

const brief = (() => {
  const created = ProductBrief.create(aProductBriefDraft())
  if (!created.ok) throw new Error('Invalid fixture')
  return created.value
})()

const persona = (() => {
  const created = Personas.create([aPersonaDraft(), aPersonaDraft({ name: 'Marc' })], brief)
  const first = created.ok ? created.value.all[0] : undefined
  if (!first) throw new Error('Invalid fixture')
  return first
})()

const create = (overrides: Partial<StoryboardDraft> = {}) => Storyboard.create(aStoryboardDraft(overrides), persona, brief)

const violations = (overrides: Partial<StoryboardDraft>) => {
  const created = create(overrides)
  return created.ok ? [] : created.error.violations
}

const visual = { type: 'cards', items: ['Un', 'Deux'] } as const

/** The fixture's scenes, with one of them replaced. */
const scenesWith = (index: number, scene: Scene): Scene[] => aStoryboardDraft().scenes.map((current, i) => (i === index ? scene : current))

describe('Storyboard', () => {
  it('is written for one persona and knows how long it lasts', () => {
    const storyboard = create()

    expect(storyboard.ok && storyboard.value.props.persona).toBe('Léa')
    // hook 3.86 + pain 3.16 + reveal 3.16 + feature 3.62 + benefit 2.42 + cta 3
    expect(storyboard.ok && storyboard.value.seconds).toBe(19.2)
  })

  it('opens with the hook and closes with the call to action', () => {
    const scenes = [...aStoryboardDraft().scenes].reverse()

    expect(violations({ scenes })).toEqual(
      expect.arrayContaining(['La première scène doit être « hook ».', 'La dernière scène doit être « cta ».']),
    )
  })

  it('keeps the product out of the hook: it would read as an ad', () => {
    const scenes = scenesWith(0, { kind: 'hook', text: 'Découvre *Wiki Géo* maintenant' })

    expect(violations({ scenes })).toContain('scenes[0].text ne doit pas contenir le nom du produit.')
  })

  it('measures texts as they are read, without the emphasis markers', () => {
    const exactly80 = `${'a'.repeat(39)} *${'b'.repeat(40)}*`
    expect(plainText(exactly80)).toHaveLength(80)

    expect(create({ scenes: scenesWith(0, { kind: 'hook', text: exactly80 }) }).ok).toBe(true)
    expect(violations({ scenes: scenesWith(0, { kind: 'hook', text: `${exactly80}c` }) })).toContain(
      'scenes[0].text dépasse 80 caractères (81).',
    )
  })

  it('refuses an emphasis that is never closed', () => {
    const scenes = scenesWith(4, { kind: 'benefit', text: 'Tu révises *sans effort' })

    expect(violations({ scenes })).toContain("scenes[4].text a un astérisque d'emphase non refermé.")
  })

  it('only shows features the brief knows', () => {
    const scenes = scenesWith(3, { kind: 'feature', feature: 'Mode hors ligne', icon: 'bolt', visual, title: 'Sans réseau', caption: 'Partout.' })

    expect(violations({ scenes })).toContain("scenes[3].feature : « Mode hors ligne » n'est pas une fonctionnalité du brief.")
  })

  it('shows the pain before the product, and the features after', () => {
    const [hook, pain, reveal, feature, benefit, cta] = aStoryboardDraft().scenes as [Scene, Scene, Scene, Scene, Scene, Scene]

    expect(violations({ scenes: [hook, feature, reveal, pain, benefit, cta] })).toEqual(
      expect.arrayContaining([
        'scenes[1] : les scènes « feature » doivent suivre « reveal ».',
        'scenes[3] : la scène « pain » doit précéder « reveal ».',
      ]),
    )
  })

  it('needs at least one feature and exactly one reveal', () => {
    const scenes = aStoryboardDraft().scenes.filter((scene) => scene.kind !== 'feature' && scene.kind !== 'reveal')

    expect(violations({ scenes })).toEqual(
      expect.arrayContaining(['Il faut exactement une scène « reveal » (il y en a 0).', 'Il faut entre 1 et 3 scènes « feature ».']),
    )
  })

  it('only draws pictograms it knows', () => {
    const scenes = scenesWith(3, { kind: 'feature', feature: 'Défi du jour', icon: 'unicorn' as never, visual, title: 'Un défi', caption: 'Chaque jour.' })

    expect(violations({ scenes })).toContain("scenes[3].icon : « unicorn » n'est pas un pictogramme connu.")
  })

  it('shows each feature as an interface it knows, with the labels that interface needs', () => {
    const feature = (type: string, items: string[]): Scene => ({
      kind: 'feature',
      feature: 'Défi du jour',
      icon: 'calendar',
      visual: { type: type as never, items },
      title: 'Un défi',
      caption: 'Chaque jour.',
    })
    const problems = (type: string, items: string[]) => violations({ scenes: scenesWith(3, feature(type, items)) })

    expect(problems('counter', ['5 000', 'points par manche'])).toEqual([])
    expect(problems('hologram', [])).toContain("scenes[3].visual.type : « hologram » n'est pas une interface connue.")
    expect(problems('search', ['Paris'])).toContain('scenes[3].visual.items : « search » demande entre 2 et 4 libellés.')
    expect(problems('counter', ['beaucoup'])).toContain('scenes[3].visual.items[0] doit contenir le nombre affiché.')
    expect(problems('cards', ['Un', 'x'.repeat(27)])).toContain('scenes[3].visual.items[1] doit faire entre 1 et 26 caractères, sans astérisque.')
  })

  it('shows a feature written before interfaces existed with the plainest one', () => {
    const old = { kind: 'feature', feature: 'Défi du jour', icon: 'calendar', title: 'Un défi', caption: 'Chaque jour.' } as unknown as Scene
    const restored = Storyboard.restore({ persona: 'Léa', scenes: [old], post: { caption: '', hashtags: [] } })

    expect(restored.props.scenes[0]).toMatchObject({ visual: { type: 'cards', items: [] } })
  })

  it('leaves each text on screen long enough to be read', () => {
    expect(sceneSeconds({ kind: 'hook', text: 'Tu *décroches* ?' })).toBe(2.4)
    expect(sceneSeconds({ kind: 'hook', text: 'un deux trois quatre cinq six sept huit neuf dix' })).toBeCloseTo(3.2)
    // Each pain line is its own beat.
    expect(sceneSeconds({ kind: 'pain', lines: ['a', 'b', 'c'] })).toBeCloseTo(3.7)
  })

  it('is neither too short to say something nor too long to be watched to the end', () => {
    const feature = (caption: string): Scene => ({ kind: 'feature', feature: 'Défi du jour', icon: 'calendar', visual, title: 'Défi', caption })
    const short: Scene[] = [{ kind: 'hook', text: 'Tu décroches ?' }, { kind: 'reveal', line: 'Joue.' }, feature('Chaque jour.'), { kind: 'cta', text: 'Joue' }]
    const wordy = feature(Array.from({ length: 30 }, () => 'a').join(' '))
    const long = [...scenesWith(3, wordy).slice(0, 4), wordy, wordy, ...aStoryboardDraft().scenes.slice(4)]

    // 2.4 + 2.6 + 3.2 + 3
    expect(violations({ scenes: short })).toContain('La vidéo dure 11.2 s : il en faut au moins 12. Ajoutez une scène.')
    expect(violations({ scenes: long }).join(' ')).toMatch(/28 au plus/)
  })

  it('shows the real application only when it was filmed, and after the product is revealed', () => {
    const demo: Scene = { kind: 'demo', caption: 'Voilà à quoi ça *ressemble*.' }
    const [hook, pain, reveal, feature, benefit, cta] = aStoryboardDraft().scenes as [Scene, Scene, Scene, Scene, Scene, Scene]
    const withDemo = [hook, pain, reveal, demo, feature, benefit, cta]
    const create = (scenes: Scene[], filmed: boolean) => Storyboard.create(aStoryboardDraft({ scenes }), persona, brief, { demo: filmed })
    const problems = (scenes: Scene[], filmed: boolean) => {
      const created = create(scenes, filmed)
      return created.ok ? [] : created.error.violations
    }

    expect(create(withDemo, true).ok).toBe(true)
    expect(problems(withDemo, false)).toContain("Aucune scène « demo » : l'application n'est pas filmée.")
    expect(problems([hook, pain, reveal, feature, benefit, cta], true)).toContain('Il faut exactement une scène « demo » (il y en a 0).')
    expect(problems([hook, demo, pain, reveal, feature, benefit, cta], true)).toContain('scenes[1] : la scène « demo » doit suivre « reveal ».')
    // Footage needs time to be seen, however short its caption.
    expect(sceneSeconds({ kind: 'demo', caption: 'Regarde.' })).toBe(4)
  })

  it('checks what will be posted with the video', () => {
    const post = { caption: '', hashtags: ['bac', '#géo'] }

    expect(violations({ post })).toEqual(
      expect.arrayContaining([
        'post.caption doit faire entre 1 et 180 caractères.',
        'post.hashtags doit contenir entre 3 et 6 mots-dièse.',
        'post.hashtags : « bac » n\'est pas un mot-dièse valide (ex. #quiz).',
      ]),
    )
  })
})
