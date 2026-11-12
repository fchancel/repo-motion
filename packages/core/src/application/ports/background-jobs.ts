import type { ProjectId } from '../../domain/project/project'

/** Work that takes minutes and runs behind the user's back. */
export type BackgroundJob =
  | { readonly kind: 'analysis'; readonly projectId: ProjectId }
  | { readonly kind: 'personas'; readonly projectId: ProjectId }
  /** `persona`: name of the persona the video is for. */
  | { readonly kind: 'video'; readonly projectId: ProjectId; readonly persona: string }

/** Hands long-running work over to the background. A job may be delivered twice: consumers must cope. */
export interface BackgroundJobs {
  enqueue(job: BackgroundJob): Promise<void>
}
