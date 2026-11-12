import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Stage } from '../components/Stage'
import { Words, wordsEnd } from '../components/Words'
import { countWords, useFit } from '../text'
import { emphasize, emphasizeQuietly, sized } from '../look'
import { accentAt, alpha } from '../theme'
import { featureStarts } from '../timing.ts'
import { SAFE, SAFE_WIDTH, type SceneOf } from '../types'
import { bodyStyle, clamp, displayStyle, staggerFor, type ShotProps } from './shared'
import { Vignette } from './Vignette'

interface FeatureSceneProps extends ShotProps {
  scene: SceneOf<'feature'>
  /** Position of this feature among the video's features, from 0. */
  index: number
  count: number
}

/**
 * One thing the product does: a small interface in which it happens, what the viewer gets
 * in big type, then how, lighting up word by word as it is read.
 */
export const FeatureScene = ({ scene, theme, frames, enter, index, count }: FeatureSceneProps) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = accentAt(theme, index)
  const title = useFit(scene.title, displayStyle(theme), { width: SAFE_WIDTH, height: 250, max: sized(theme, 104), min: 54, lineHeight: 1.03 })
  const caption = useFit(scene.caption, bodyStyle(theme), { width: SAFE_WIDTH - 60, height: 210, max: 54, min: 38, lineHeight: 1.26, gap: 0.27 })

  const { tile: start, title: titleAt } = featureStarts(enter)
  const titleStagger = staggerFor(countWords(scene.title), 13)
  const captionAt = Math.round(wordsEnd(title, titleAt, titleStagger)) + 7
  const captionStagger = clamp((frames - captionAt - 16) / Math.max(1, countWords(scene.caption)), 2, 5.5)
  const captionIn = spring({ frame: frame - captionAt + 5, fps, config: { damping: 200 } })

  return (
    <Stage theme={theme} glow={accent} fill={accentAt(theme, index + 1)} at={[24, 30]}>
      <AbsoluteFill
        style={{
          padding: `${SAFE.top}px ${SAFE.right}px ${SAFE.bottom}px ${SAFE.left}px`,
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        {count > 1 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 36 }}>
            {Array.from({ length: count }, (_, step) => (
              <div
                key={step}
                style={{
                  width: step === index ? 110 : 44,
                  height: 12,
                  borderRadius: 6,
                  background: step === index ? accent : alpha(theme.text, step < index ? 0.5 : 0.18),
                }}
              />
            ))}
          </div>
        )}

        <div style={{ marginBottom: 46 }}>
          <Vignette visual={scene.visual ?? { type: 'cards', items: [] }} icon={scene.icon} theme={theme} accent={accent} at={start} />
        </div>

        <Words fitted={title} color={theme.text} emphasis={emphasize(theme, 'color', accent)} at={titleAt} stagger={titleStagger} />

        <div style={{ marginTop: 26, opacity: captionIn, transform: `translateY(${(1 - captionIn) * 24}px)` }}>
          <Words
            fitted={caption}
            color={theme.text}
            emphasis={emphasizeQuietly(theme, accent)}
            at={captionAt}
            stagger={captionStagger}
            mode="karaoke"
          />
        </div>
      </AbsoluteFill>
    </Stage>
  )
}
