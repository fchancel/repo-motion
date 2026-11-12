import type { ProjectId, ProjectSnapshot } from '../../domain/project/project'
import { err, ok, type Result } from '../../shared/result'
import type { Failure } from '../../shared/errors'
import { projectNotFound, type ProjectNotFound } from '../errors'
import type { ClaudeCode, ClaudeCodeStatus } from '../ports/claude-code'
import type { ProjectFolders } from '../ports/project-folders'
import type { ProjectRepository } from '../ports/repositories'

export class ListProjects {
  constructor(private readonly deps: { readonly projects: ProjectRepository }) {}

  async execute(): Promise<ProjectSnapshot[]> {
    return (await this.deps.projects.list()).map((project) => project.toSnapshot())
  }
}

export class GetProject {
  constructor(private readonly deps: { readonly projects: ProjectRepository }) {}

  async execute({ projectId }: { readonly projectId: ProjectId }): Promise<Result<ProjectSnapshot, ProjectNotFound>> {
    const project = await this.deps.projects.findById(projectId)
    return project ? ok(project.toSnapshot()) : err(projectNotFound())
  }
}

export type VideoNotFound = Failure<'VideoNotFound'>

/** Where a finished video is on this machine, so it can be played or downloaded. */
export class GetVideoFile {
  constructor(private readonly deps: { readonly projects: ProjectRepository }) {}

  async execute(query: {
    readonly projectId: ProjectId
    readonly persona: string
  }): Promise<Result<{ file: string; product: string }, ProjectNotFound | VideoNotFound>> {
    const project = await this.deps.projects.findById(query.projectId)
    if (!project) return err(projectNotFound())

    const video = project.videos.find((candidate) => candidate.persona === query.persona)?.state
    if (video?.status !== 'succeeded') {
      return err({ type: 'VideoNotFound', message: "Cette vidéo n'existe pas, ou n'est pas encore terminée." })
    }
    return ok({ file: video.file, product: project.brief?.props.productName ?? project.folder.name })
  }
}

export class GetClaudeCodeStatus {
  constructor(private readonly deps: { readonly claudeCode: ClaudeCode }) {}

  execute(): Promise<ClaudeCodeStatus> {
    return this.deps.claudeCode.status()
  }
}

export class SuggestFolders {
  constructor(private readonly deps: { readonly folders: ProjectFolders }) {}

  execute({ input }: { readonly input: string }): Promise<string[]> {
    return this.deps.folders.suggest(input)
  }
}
