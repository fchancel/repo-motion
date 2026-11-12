import type { BackgroundJob, BackgroundJobs } from '@repo-motion/core'

/**
 * Runs background work inside the application's own process, a few jobs at a time.
 * Nothing survives a restart: `RecoverInterruptedWork` cleans up at the next start.
 */
export class InProcessBackgroundJobs implements BackgroundJobs {
  private readonly waiting: BackgroundJob[] = []
  private readonly running = new Set<Promise<void>>()

  constructor(
    private readonly handle: (job: BackgroundJob) => Promise<unknown>,
    private readonly concurrency = 2,
  ) {}

  async enqueue(job: BackgroundJob): Promise<void> {
    this.waiting.push(job)
    this.drain()
  }

  /** Resolves once nothing is waiting or running. */
  async idle(): Promise<void> {
    while (this.running.size > 0) await Promise.all(this.running)
  }

  private drain(): void {
    while (this.running.size < this.concurrency) {
      const next = this.waiting.shift()
      if (next === undefined) return

      const work: Promise<void> = this.handle(next)
        .then(() => undefined)
        .catch((error: unknown) => {
          // The use cases record expected failures themselves: anything reaching here is a bug.
          console.error(`[jobs] ${next.kind} of project ${next.projectId} crashed:`, error)
        })
        .finally(() => {
          this.running.delete(work)
          this.drain()
        })
      this.running.add(work)
    }
  }
}
