import { describe, expect, it } from 'vitest'
import { ProductBrief } from '../analysis/product-brief'
import { aProductBriefDraft } from '../../testing/fixtures'
import { Project, ProjectId } from './project'
import { ProjectFolder } from './project-folder'

const now = new Date('2026-01-01T10:00:00Z')

const aProject = () => {
  const folder = ProjectFolder.of('/home/ada/app')
  if (!folder.ok) throw new Error('fixture')
  return Project.add({ id: ProjectId('p1'), folder: folder.value, now })
}

const aBrief = () => {
  const brief = ProductBrief.create(aProductBriefDraft())
  if (!brief.ok) throw new Error('fixture')
  return brief.value
}

describe('Project analysis lifecycle', () => {
  it('goes from queued to running to succeeded', () => {
    const project = aProject()

    expect(project.requestAnalysis(now).ok).toBe(true)
    expect(project.startAnalysis(now).ok).toBe(true)
    expect(project.completeAnalysis(aBrief(), now).ok).toBe(true)
    expect(project.analysis.status).toBe('succeeded')
  })

  it('refuses a second request while an analysis is pending', () => {
    const project = aProject()
    project.requestAnalysis(now)

    const second = project.requestAnalysis(now)
    expect(second.ok ? null : second.error).toMatchObject({ type: 'InvalidAnalysisTransition', from: 'queued' })
  })

  it('does not start an analysis twice', () => {
    const project = aProject()
    project.requestAnalysis(now)
    project.startAnalysis(now)

    expect(project.startAnalysis(now).ok).toBe(false)
  })

  it('records what Claude is doing while the analysis runs', () => {
    const project = aProject()
    project.reportActivity('ignored: nothing is running')
    project.requestAnalysis(now)
    project.startAnalysis(now)
    project.reportActivity('Lecture de README.md')

    expect(project.analysis).toMatchObject({ status: 'running', activity: 'Lecture de README.md' })
  })

  it('cannot complete an analysis that was never started', () => {
    expect(aProject().completeAnalysis(aBrief(), now).ok).toBe(false)
  })

  it('allows a new analysis once the previous one failed', () => {
    const project = aProject()
    project.requestAnalysis(now)
    project.failAnalysis('boom', now)

    expect(project.requestAnalysis(now).ok).toBe(true)
  })
})
