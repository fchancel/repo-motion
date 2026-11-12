import { linearTiming, springTiming, TransitionSeries, type TransitionPresentation, type TransitionTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { slide } from '@remotion/transitions/slide'
import { Fragment, useMemo, type ReactNode } from 'react'
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { LogoTile } from './components/LogoTile'
import { useFonts } from './fonts'
import { ThemeProvider } from './look'
import { BenefitScene } from './scenes/BenefitScene'
import { CtaScene } from './scenes/CtaScene'
import { DemoScene } from './scenes/DemoScene'
import { FeatureScene } from './scenes/FeatureScene'
import { HookScene } from './scenes/HookScene'
import { PainScene } from './scenes/PainScene'
import { RevealScene } from './scenes/RevealScene'
import type { ShotProps } from './scenes/shared'
import { makeTheme, shotTheme, type Theme } from './theme'
import { CUTS, cutFrames, sceneFrames } from './timing.ts'
import { iris, snap, tiles, zoom } from './transitions'
import { SAFE, type Scene, type VideoProps } from './types'

type AnyPresentation = TransitionPresentation<Record<string, unknown>>

interface Cut {
  presentation: AnyPresentation
  timing: TransitionTiming
  frames: number
}

/** Each presentation has its own props; the series only needs to play it. */
const play = <Props extends Record<string, unknown>>(presentation: TransitionPresentation<Props>): AnyPresentation =>
  presentation as unknown as AnyPresentation

const smooth = (frames: number) => springTiming({ config: { damping: 200 }, durationInFrames: frames })
const eased = (frames: number, easing: (value: number) => number) => linearTiming({ durationInFrames: frames, easing })

/** How one shot gives way to the next. Each look cuts in its own way; none cuts plainly. */
const cutInto = (next: Scene, theme: Theme): Cut => {
  const frames = cutFrames(next.kind, theme.look)
  const product = next.kind === 'reveal' || next.kind === 'cta'
  const style = CUTS[theme.look]

  if (style === 'fade') return { presentation: play(fade()), timing: eased(frames, Easing.inOut(Easing.quad)), frames }
  if (style === 'snap' && !(product && theme.flood !== theme.bg)) {
    // The flash is the look's own light: white on colour blocks, the brand's colour in the dark.
    const flash = theme.textGlow ? theme.primary : theme.face === 'mono' ? theme.bg : theme.text
    return { presentation: play(snap(flash)), timing: eased(frames, Easing.out(Easing.cubic)), frames }
  }

  switch (next.kind) {
    case 'reveal':
    case 'cta':
      // Squares of the brand's colour close on the shot, and open on the product.
      return theme.kinetic
        ? { presentation: play(tiles(theme.flood)), timing: eased(frames, Easing.inOut(Easing.quad)), frames }
        : { presentation: play(iris()), timing: eased(frames, Easing.bezier(0.6, 0, 0.3, 1)), frames }
    case 'pain':
      return { presentation: play(slide({ direction: 'from-bottom' })), timing: smooth(frames), frames }
    case 'demo':
    case 'feature':
      return { presentation: play(slide({ direction: 'from-right' })), timing: smooth(frames), frames }
    case 'benefit':
      return { presentation: play(zoom()), timing: eased(frames, Easing.inOut(Easing.cubic)), frames }
    case 'hook':
      return { presentation: play(fade()), timing: eased(frames, (value) => value), frames }
  }
}

const renderScene = (scene: Scene, shot: ShotProps, features: Scene[]): ReactNode => {
  switch (scene.kind) {
    case 'hook':
      return <HookScene scene={scene} {...shot} />
    case 'pain':
      return <PainScene scene={scene} {...shot} />
    case 'reveal':
      return <RevealScene scene={scene} {...shot} />
    case 'demo':
      return <DemoScene scene={scene} {...shot} />
    case 'feature':
      return <FeatureScene scene={scene} {...shot} index={features.indexOf(scene)} count={features.length} />
    case 'benefit':
      return <BenefitScene scene={scene} {...shot} />
    case 'cta':
      return <CtaScene scene={scene} {...shot} />
  }
}

/** How far the video is, along the bottom edge: people stay when they can see the end coming. */
const ProgressBar = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  return (
    // A dark track under a white bar: it reads on the dark stage as well as on the brand's colour.
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: 'rgba(0, 0, 0, 0.32)' }}>
      <div style={{ height: '100%', width: `${((frame + 1) / durationInFrames) * 100}%`, background: '#ffffff', opacity: 0.92 }} />
    </div>
  )
}

/** Once revealed, the product stays signed in a corner of the shots that follow. */
const BrandMark = ({ theme, video, appears }: { theme: Theme; video: VideoProps; appears: boolean }) => {
  const frame = useCurrentFrame()
  const opacity = appears ? interpolate(frame, [8, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1

  return (
    <div style={{ position: 'absolute', left: SAFE.left, top: SAFE.top - 96, display: 'flex', alignItems: 'center', gap: 18, opacity }}>
      <LogoTile theme={theme} logo={video.logo} name={video.product.name} size={58} />
      <span style={{ fontFamily: theme.display, fontStretch: theme.displayStretch, fontWeight: 700, fontSize: 34, letterSpacing: '-0.02em', color: theme.text }}>
        {video.product.name}
      </span>
    </div>
  )
}

const SIGNED: Scene['kind'][] = ['demo', 'feature', 'benefit']

/** One persona's video: its shots in order, each giving way to the next. */
export const PersonaVideo = (video: VideoProps) => {
  const { fps, durationInFrames } = useVideoConfig()
  const ready = useFonts([video.fonts.display, video.fonts.body])
  const base = useMemo(() => makeTheme(video.colors, video.fonts, video.look), [video.colors, video.fonts, video.look])
  if (!ready) return null

  const { scenes } = video
  const features: Scene[] = scenes.filter((scene) => scene.kind === 'feature')
  const cuts = scenes.map((scene, index) => (index === 0 ? null : cutInto(scene, base)))
  const firstSigned = scenes.findIndex((scene) => SIGNED.includes(scene.kind))

  return (
    <AbsoluteFill style={{ background: base.bg }}>
      <TransitionSeries>
        {scenes.map((scene, index) => {
          const cut = cuts[index]
          const leaving = cuts[index + 1]
          const frames = sceneFrames(scene, fps)
          const theme = shotTheme(base, scene.kind, features.indexOf(scene))
          const shot: ShotProps = { theme, video, frames, enter: cut?.frames ?? 0 }
          // The demo shot needs pictures: without any, it is skipped rather than shown empty.
          if (scene.kind === 'demo' && video.screens.length === 0) return null
          return (
            <Fragment key={index}>
              {cut && <TransitionSeries.Transition presentation={cut.presentation} timing={cut.timing} />}
              {/* A shot stays a little longer, under the next one arriving: the video's length is unchanged. */}
              <TransitionSeries.Sequence durationInFrames={frames + (leaving?.frames ?? 0)}>
                <ThemeProvider value={theme}>
                  {renderScene(scene, shot, features)}
                  {SIGNED.includes(scene.kind) && <BrandMark theme={theme} video={video} appears={index === firstSigned} />}
                </ThemeProvider>
              </TransitionSeries.Sequence>
            </Fragment>
          )
        })}
      </TransitionSeries>

      <ProgressBar />
      {video.audio.effects && <Audio src={staticFile(video.audio.effects)} />}
      {/* The user's own music comes in quickly and fades out with the video, wherever the track is by then. */}
      {video.audio.music && (
        <Audio
          src={staticFile(video.audio.music)}
          volume={(frame) => interpolate(frame, [0, 6, durationInFrames - 30, durationInFrames - 1], [0, 0.75, 0.75, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
    </AbsoluteFill>
  )
}
