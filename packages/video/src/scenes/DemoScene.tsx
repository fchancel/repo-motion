import { AbsoluteFill } from 'remotion'
import { Phone, phoneSize } from '../components/Phone'
import { Stage } from '../components/Stage'
import { Words } from '../components/Words'
import { emphasize, sized } from '../look'
import { countWords, useFit } from '../text'
import { accentAt } from '../theme'
import { demoStarts, staggerFor } from '../timing.ts'
import { HEIGHT, SAFE, SAFE_WIDTH, WIDTH, type SceneOf } from '../types'
import { displayStyle, type ShotProps } from './shared'

const CAPTION_GAP = 56

/**
 * The real application, in a phone: each page scrolls the way a thumb would scroll it,
 * while the caption says what to look at.
 */
export const DemoScene = ({ scene, theme, video, frames, enter }: ShotProps & { scene: SceneOf<'demo'> }) => {
  const accent = accentAt(theme, 0)
  const size = phoneSize()
  const caption = useFit(scene.caption, displayStyle(theme), { width: SAFE_WIDTH, height: 250, max: sized(theme, 92), min: 50, lineHeight: 1.05 })

  const start = demoStarts(enter)

  const phoneTop = SAFE.top + caption.height + CAPTION_GAP

  return (
    <Stage theme={theme} glow={accent} fill={accentAt(theme, 2)} at={[50, ((phoneTop + size.height / 2) / HEIGHT) * 100]} intensity={1.1}>
      <AbsoluteFill style={{ padding: `${SAFE.top}px ${SAFE.right}px 0 ${SAFE.left}px`, alignItems: 'center' }}>
        <Words
          fitted={caption}
          color={theme.text}
          emphasis={emphasize(theme, 'color', accent)}
          align="center"
          at={start + 3}
          stagger={staggerFor(countWords(scene.caption), frames * 0.3)}
        />
      </AbsoluteFill>

      {/* The phone runs past the bottom of the safe area: what is under the platforms' caption is only more of the page. */}
      <div style={{ position: 'absolute', left: (WIDTH - size.width) / 2, top: phoneTop }}>
        <Phone screens={video.screens} at={start} frames={frames - start} glow={theme.backdrop === 'glow' || theme.textGlow ? accent : undefined} />
      </div>
    </Stage>
  )
}
