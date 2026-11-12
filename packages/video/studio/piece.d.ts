/** The piece being directed: resolved to the workspace's `src/Video.tsx` when it is bundled. */
declare module '@piece/Video' {
  import type { ComponentType } from 'react'
  import type { PieceProps } from '../src/types'

  const Video: ComponentType<PieceProps>
  export default Video
  export const DURATION_SECONDS: number
}
