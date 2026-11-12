import { describe, expect, it } from 'vitest'
import { aPersonaDraft, aPieceDraft, aProductBriefDraft } from '../../testing'
import { ProductBrief } from '../analysis/product-brief'
import { Personas } from '../persona/persona'
import { DirectedPiece, type DirectedPieceDraft } from './piece'

const persona = (() => {
  const brief = ProductBrief.create(aProductBriefDraft())
  const personas = brief.ok ? Personas.create([aPersonaDraft(), aPersonaDraft({ name: 'Marc' })], brief.value) : null
  const first = personas?.ok ? personas.value.all[0] : undefined
  if (!first) throw new Error('Invalid fixture')
  return first
})()

const violations = (overrides: Partial<DirectedPieceDraft>) => {
  const created = DirectedPiece.create(aPieceDraft(overrides), persona)
  return created.ok ? [] : created.error.violations
}

describe('DirectedPiece', () => {
  it('is what a director reports of a video: its idea, its shots, what to post', () => {
    const piece = DirectedPiece.create(aPieceDraft(), persona)

    expect(piece.ok && piece.value.props.persona).toBe('Léa')
    expect(piece.ok && piece.value.seconds).toBe(18)
  })

  it('needs an idea, and enough shots to tell it', () => {
    expect(violations({ concept: ' ' })).toContain('concept doit faire entre 1 et 320 caractères.')
    expect(violations({ shots: aPieceDraft().shots.slice(0, 2) })).toContain('Il faut entre 3 et 16 plans (il y en a 2).')
  })

  it('lasts as long as a short video does', () => {
    const shot = (seconds: number) => ({ label: 'Plan', text: '', seconds })

    expect(violations({ shots: [shot(2), shot(3), shot(4)] })).toContain('La vidéo dure 9.0 s : elle doit durer entre 12 et 45 s.')
    expect(violations({ shots: [shot(20), shot(20), shot(10)] })).toContain('La vidéo dure 50.0 s : elle doit durer entre 12 et 45 s.')
    expect(violations({ shots: [shot(8), shot(8), shot(-1)] })).toContain('shots[2].seconds doit être une durée positive.')
  })

  it('checks what will be posted with the video', () => {
    expect(violations({ post: { caption: '', hashtags: ['bac'] } })).toEqual(
      expect.arrayContaining([
        'post.caption doit faire entre 1 et 180 caractères.',
        'post.hashtags doit contenir entre 3 et 6 mots-dièse.',
        "post.hashtags : « bac » n'est pas un mot-dièse valide (ex. #quiz).",
      ]),
    )
  })
})
