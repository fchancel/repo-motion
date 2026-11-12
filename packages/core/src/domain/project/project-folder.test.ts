import { describe, expect, it } from 'vitest'
import { ProjectFolder } from './project-folder'

describe('ProjectFolder', () => {
  it.each([
    ['/Users/ada/code/wiki-geo', '/Users/ada/code/wiki-geo', 'wiki-geo'],
    ['/Users/ada/code/wiki-geo/', '/Users/ada/code/wiki-geo', 'wiki-geo'],
    ['  /srv/app  ', '/srv/app', 'app'],
    ['C:\\Users\\ada\\app', 'C:\\Users\\ada\\app', 'app'],
    ['/', '/', '/'],
  ])('accepts %s', (input, path, name) => {
    const folder = ProjectFolder.of(input)
    expect(folder.ok && [folder.value.path, folder.value.name]).toEqual([path, name])
  })

  it.each(['', 'wiki-geo', './wiki-geo', '~/code/wiki-geo'])('rejects %s, which is not absolute', (input) => {
    const folder = ProjectFolder.of(input)
    expect(folder.ok ? null : folder.error.type).toBe('InvalidProjectFolder')
  })

  it('compares folders by path', () => {
    const a = ProjectFolder.of('/srv/app/')
    const b = ProjectFolder.of('/srv/app')
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true)
  })
})
