import { describe, expect, it } from 'vitest'
import { aProductBriefDraft, aScriptDraft, aViewerTest } from '../../testing'
import { ProductBrief } from '../analysis/product-brief'
import { beatReadingSeconds, Script, type ScriptDraft } from './script'

const brief = (() => {
  const created = ProductBrief.create(aProductBriefDraft())
  if (!created.ok) throw new Error('Invalid fixture')
  return created.value
})()

const beats = aScriptDraft().beats
const beat = (index: number) => {
  const found = beats[index]
  if (!found) throw new Error('fixture')
  return found
}

const violations = (overrides: Partial<ScriptDraft>) => {
  const created = Script.create(aScriptDraft(overrides), brief)
  return created.ok ? [] : created.error.violations
}

const script = (() => {
  const created = Script.create(aScriptDraft(), brief)
  if (!created.ok) throw new Error(created.error.violations.join(' '))
  return created.value
})()

describe('Script', () => {
  it('knows how long it lasts and when each beat starts', () => {
    expect(script.seconds).toBe(16)
    expect(script.starts).toEqual([0, 2.5, 5.5, 8.5, 11, 13.5])
    expect(script.contextStart).toBe(2.5)
  })

  it('gives each text the time it takes to read: half a second, then a quarter per word', () => {
    expect(beatReadingSeconds('Où est cette ville ? Tu as *5 secondes*.')).toBe(2.5)
    expect(beatReadingSeconds('')).toBe(0)

    expect(violations({ beats: [{ ...beat(0), seconds: 1.5 }, ...beats.slice(1)] })).toContain(
      'beats[0] : « Où est cette ville ? Tu as 5 secondes. » demande 2.5 s de lecture, il n\'en a que 1.5.',
    )
  })

  it('opens on a hook short enough to decide in under three seconds, without the product’s name', () => {
    const named = { ...beat(0), onScreen: 'Tu connais *Wiki Géo* ?' }
    const slow = { ...beat(0), seconds: 3.5 }

    expect(violations({ beats: [named, ...beats.slice(1)] })).toContain("L'accroche ne doit pas contenir le nom du produit.")
    expect(violations({ beats: [slow, ...beats.slice(1)] })).toContain("L'accroche dure 3.5 s : 3 au plus.")
    expect(violations({ beats: beats.slice(1) })).toContain('Le premier temps doit être « hook ».')
  })

  it('says what it is about before the sixth second', () => {
    const withoutContext = beats.map((beat) => (beat.role === 'context' ? { ...beat, role: 'proof' } : beat))
    const late = [beat(0), { ...beat(2), seconds: 4 }, beat(3), beat(1), ...beats.slice(4)]

    expect(violations({ beats: withoutContext })).toContain("Il manque un temps « context » : celui qui dit clairement de quoi il s'agit.")
    expect(violations({ beats: late })).toContain('Le temps « context » commence à 9 s : le spectateur doit savoir de quoi on parle avant 6 s.')
  })

  it('answers the question it opened, and ends on one thing to do', () => {
    const unanswered = beats.map((beat) => (beat.role === 'payoff' ? { ...beat, role: 'proof' } : beat))

    expect(violations({ beats: unanswered })).toContain('La question ouverte au début (openLoop) doit trouver sa réponse dans un temps « payoff ».')
    expect(violations({ beats: unanswered, openLoop: null })).toEqual([])
    expect(violations({ beats: beats.slice(0, -1) })).toContain('Le dernier temps doit être « cta ».')
  })

  it('refuses a format or a role it does not know', () => {
    expect(violations({ format: 'unboxing' })).toContain("format : « unboxing » n'est pas un format connu.")
    expect(violations({ beats: [beat(0), { ...beat(1), role: 'vibe' }, ...beats.slice(2)] })).toContain(
      "beats[1].role : « vibe » n'est pas un rôle connu.",
    )
  })

  describe('judged by a viewer who knew nothing', () => {
    it('passes when understood early and watched to the end', () => {
      expect(script.verdict).toBeNull()
      expect(script.tested(aViewerTest()).verdict).toBe('pass')
    })

    it('is weak when understood late, or left after being understood', () => {
      expect(script.tested(aViewerTest({ understoodAt: 9 })).verdict).toBe('weak')
      expect(script.tested(aViewerTest({ leftAt: 10 })).verdict).toBe('weak')
    })

    it('fails when never understood, or left before being told what it is', () => {
      expect(script.tested(aViewerTest({ understoodAt: null })).verdict).toBe('fail')
      expect(script.tested(aViewerTest({ leftAt: 1.5 })).verdict).toBe('fail')
    })
  })

  describe('edited by the user', () => {
    const texts = beats.map((beat) => beat.onScreen)

    it('keeps the script as it was when nothing changed', () => {
      const tested = script.tested(aViewerTest())
      const same = tested.edit(texts, brief)

      expect(same.ok && same.value).toBe(tested)
    })

    it('keeps a longer text on screen long enough to be read, and remembers it was not tested', () => {
      const tested = script.tested(aViewerTest())
      const edited = tested.edit(texts.with(3, 'Indice : un *fleuve* la traverse, et deux villes voisines la bordent.'), brief)

      expect(edited.ok && edited.value.props.beats[3]?.seconds).toBe(3.3)
      expect(edited.ok && edited.value.props).toMatchObject({ edited: true, test: tested.props.test })
    })

    it('refuses texts for a different number of beats', () => {
      const edited = script.edit(texts.slice(1), brief)

      expect(edited.ok ? null : edited.error.message).toBe('Ce script a changé entre-temps.')
    })
  })
})
