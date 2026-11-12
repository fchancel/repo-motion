import type { Failure } from '../../shared/errors'
import { err, ok, type Result } from '../../shared/result'
import type { Persona } from '../persona/persona'
import type { PostCopy } from './storyboard'

/** One moment of a directed video, as its director describes it. */
export interface PieceShot {
  /** What the shot is for, in a couple of words ("Accroche", "Le jeu"). */
  readonly label: string
  /** What is read on screen during it. */
  readonly text: string
  readonly seconds: number
}

export interface DirectedPieceProps {
  readonly persona: string
  /** The idea of the video, in a sentence or two: what makes it this video and no other. */
  readonly concept: string
  readonly shots: readonly PieceShot[]
  /** What to post with the video. */
  readonly post: PostCopy
}

/** Untrusted input: what the director says it made. */
export type DirectedPieceDraft = Omit<DirectedPieceProps, 'persona'>

export interface InvalidDirectedPiece extends Failure<'InvalidDirectedPiece'> {
  readonly violations: readonly string[]
}

export const DIRECTED_PIECE_RULES = {
  maxConceptLength: 320,
  minShots: 3,
  maxShots: 16,
  maxShotLabelLength: 40,
  maxShotTextLength: 200,
  /** A directed video may run longer than one made of ready-made shots: it has more to show. */
  minSeconds: 12,
  maxSeconds: 45,
  maxPostCaptionLength: 180,
  minHashtags: 3,
  maxHashtags: 6,
} as const

const HASHTAG = /^#[\p{L}\p{N}_]{2,30}$/u

/**
 * A video Claude directed from scratch: its code is the video itself, and lives with the
 * renderer. This is what the director reports of it: the idea, the shots, what to post.
 */
export class DirectedPiece {
  private constructor(readonly props: DirectedPieceProps) {}

  static create(draft: DirectedPieceDraft, persona: Persona): Result<DirectedPiece, InvalidDirectedPiece> {
    const rules = DIRECTED_PIECE_RULES
    const violations: string[] = []
    const { concept, shots, post } = draft

    if (concept.trim().length === 0 || concept.length > rules.maxConceptLength) {
      violations.push(`concept doit faire entre 1 et ${rules.maxConceptLength} caractères.`)
    }
    if (shots.length < rules.minShots || shots.length > rules.maxShots) {
      violations.push(`Il faut entre ${rules.minShots} et ${rules.maxShots} plans (il y en a ${shots.length}).`)
    }
    shots.forEach((shot, index) => {
      if (shot.label.trim().length === 0 || shot.label.length > rules.maxShotLabelLength) {
        violations.push(`shots[${index}].label doit faire entre 1 et ${rules.maxShotLabelLength} caractères.`)
      }
      if (shot.text.length > rules.maxShotTextLength) violations.push(`shots[${index}].text dépasse ${rules.maxShotTextLength} caractères.`)
      if (!(shot.seconds > 0)) violations.push(`shots[${index}].seconds doit être une durée positive.`)
    })

    const seconds = shots.reduce((total, shot) => total + (shot.seconds > 0 ? shot.seconds : 0), 0)
    if (seconds < rules.minSeconds || seconds > rules.maxSeconds) {
      violations.push(`La vidéo dure ${seconds.toFixed(1)} s : elle doit durer entre ${rules.minSeconds} et ${rules.maxSeconds} s.`)
    }

    if (post.caption.trim().length === 0 || post.caption.length > rules.maxPostCaptionLength) {
      violations.push(`post.caption doit faire entre 1 et ${rules.maxPostCaptionLength} caractères.`)
    }
    if (post.hashtags.length < rules.minHashtags || post.hashtags.length > rules.maxHashtags) {
      violations.push(`post.hashtags doit contenir entre ${rules.minHashtags} et ${rules.maxHashtags} mots-dièse.`)
    }
    for (const hashtag of post.hashtags) {
      if (!HASHTAG.test(hashtag)) violations.push(`post.hashtags : « ${hashtag} » n'est pas un mot-dièse valide (ex. #quiz).`)
    }

    if (violations.length > 0) {
      return err({ type: 'InvalidDirectedPiece', message: 'Le compte rendu de la vidéo est incomplet.', violations })
    }
    return ok(new DirectedPiece({ persona: persona.name, concept: concept.trim(), shots, post }))
  }

  /** Rebuilds a piece that was already validated (e.g. read back from disk). */
  static restore(props: DirectedPieceProps): DirectedPiece {
    return new DirectedPiece(props)
  }

  get seconds(): number {
    return Math.round(this.props.shots.reduce((total, shot) => total + shot.seconds, 0) * 10) / 10
  }
}
