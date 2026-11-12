import { createElement } from 'react'
import {
  Bell, BookOpen, Calendar, Camera, ChartColumn, CircleCheck, Clock, Code, Coins, Eye, FileText, Flag, Gamepad2, Gift,
  Globe, Heart, Image, Languages, Layers, Lock, MapPin, MessageCircle, Mic, Music, PenLine, Puzzle, Rocket, Search,
  Share2, ShieldCheck, ShoppingCart, Sparkles, Star, Target, Trophy, Users, Video, Wallet, WandSparkles, Zap,
  type IconNode,
} from 'lucide' // prettier-ignore
import { interpolate, useCurrentFrame } from 'remotion'

/** The storyboard names a pictogram; this is how each one is drawn. */
const ICONS: Record<string, IconNode> = {
  bolt: Zap, target: Target, clock: Clock, calendar: Calendar, chart: ChartColumn, users: Users, lock: Lock,
  shield: ShieldCheck, sparkles: Sparkles, 'map-pin': MapPin, globe: Globe, trophy: Trophy, heart: Heart,
  search: Search, chat: MessageCircle, bell: Bell, wallet: Wallet, camera: Camera, code: Code, gamepad: Gamepad2,
  book: BookOpen, gift: Gift, rocket: Rocket, eye: Eye, share: Share2, star: Star, music: Music, cart: ShoppingCart,
  file: FileText, languages: Languages, video: Video, wand: WandSparkles, check: CircleCheck, coins: Coins,
  layers: Layers, mic: Mic, pen: PenLine, image: Image, flag: Flag, puzzle: Puzzle,
} // prettier-ignore

interface IconProps {
  name: string
  size: number
  color: string
  /** Frame at which the first stroke starts. */
  at?: number
  /** Frames each stroke takes to draw. */
  duration?: number
  strokeWidth?: number
}

/** A line pictogram that draws itself, stroke after stroke. */
export const Icon = ({ name, size, color, at = 0, duration = 16, strokeWidth = 1.5 }: IconProps) => {
  const frame = useCurrentFrame()
  const [, , shapes = []] = ICONS[name] ?? Sparkles

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes.map(([tag, attributes], index) => {
        const start = at + index * 4
        const drawn = interpolate(frame, [start, start + duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        // Ease out: fast at first, settling at the end.
        const eased = 1 - (1 - drawn) ** 3
        return createElement(tag, {
          ...attributes,
          key: index,
          pathLength: 1,
          strokeDasharray: 1,
          strokeDashoffset: 1 - eased,
          opacity: drawn > 0 ? 1 : 0,
        })
      })}
    </svg>
  )
}
