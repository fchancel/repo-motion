import type { ProjectId, ProjectSnapshot } from '../../domain/project/project'
import { VideoSetup, type InvalidVideoSetup, type VideoSetupDraft } from '../../domain/video/direction'
import { err, ok, type Result } from '../../shared/result'
import { projectNotFound, type ProjectNotFound } from '../errors'
import type { ProjectRepository } from '../ports/repositories'
import type { AudioTracks, TrackNotFound } from '../ports/video'

export interface SetUpVideosCommand {
  readonly projectId: ProjectId
  readonly setup: VideoSetupDraft
}

export type SetUpVideosError = ProjectNotFound | InvalidVideoSetup | TrackNotFound

/**
 * Records what all the videos of a project share: how the application is shown, and the
 * user's own music. Videos already made or in production keep what they were asked with.
 */
export class SetUpVideos {
  constructor(private readonly deps: { readonly projects: ProjectRepository; readonly audioTracks: AudioTracks }) {}

  async execute(command: SetUpVideosCommand): Promise<Result<ProjectSnapshot, SetUpVideosError>> {
    const { projects, audioTracks } = this.deps

    const created = VideoSetup.create(command.setup)
    if (!created.ok) return created

    // Checked now, while the user is looking at the form, not a minute into a render.
    let setup = created.value
    if (setup.props.track) {
      const track = await audioTracks.resolve(setup.props.track)
      if (!track.ok) return track
      setup = setup.withTrack(track.value)
    }

    const saved = await projects.update(command.projectId, (project) => {
      project.setUpVideos(setup)
      return project.toSnapshot()
    })
    return saved ? ok(saved) : err(projectNotFound())
  }
}
