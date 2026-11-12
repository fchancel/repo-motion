import type { BackgroundJob, BackgroundJobs } from '../application/ports/background-jobs'
import type { ProjectRepository } from '../application/ports/repositories'
import type { Clock, IdGenerator } from '../application/ports/system'
import { Project, type ProjectId, type ProjectSnapshot } from '../domain/project/project'

/** In-memory adapters: used by the core's tests, and handy for local prototyping. */

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly rows = new Map<ProjectId, ProjectSnapshot>()

  async findById(id: ProjectId): Promise<Project | null> {
    const row = this.rows.get(id)
    return row ? Project.restore(row) : null
  }

  async list(): Promise<Project[]> {
    return [...this.rows.values()].map((row) => Project.restore(row))
  }

  async save(project: Project): Promise<void> {
    this.rows.set(project.id, project.toSnapshot())
  }

  async remove(id: ProjectId): Promise<void> {
    this.rows.delete(id)
  }

  async update<T>(id: ProjectId, change: (project: Project) => T): Promise<T | null> {
    const row = this.rows.get(id)
    if (!row) return null
    const project = Project.restore(row)
    const result = change(project)
    this.rows.set(id, project.toSnapshot())
    return result
  }
}

export class InMemoryBackgroundJobs implements BackgroundJobs {
  readonly enqueued: BackgroundJob[] = []

  async enqueue(job: BackgroundJob): Promise<void> {
    this.enqueued.push(job)
  }
}

export class FixedClock implements Clock {
  constructor(private current = new Date('2026-01-01T10:00:00Z')) {}

  now(): Date {
    return this.current
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds)
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0

  next(): string {
    this.counter += 1
    return `id-${this.counter}`
  }
}
