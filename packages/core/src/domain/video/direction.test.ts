import { describe, expect, it } from 'vitest'
import { createVideoStyle, DEFAULT_STYLE, demoPagesOn, LOOKS, TONES, VideoDirection, VideoSetup, type VideoSetupDraft } from './direction'

const setup = (overrides: Partial<VideoSetupDraft> = {}): VideoSetupDraft => ({ production: 'directed', demo: { mode: 'none', addresses: [] }, track: null, ...overrides })

const violations = (overrides: Partial<VideoSetupDraft>) => {
  const created = VideoSetup.create(setup(overrides))
  return created.ok ? [] : created.error.violations
}

const demo = (mode: string, addresses: string[]) => ({ demo: { mode, addresses } })

describe('VideoStyle', () => {
  it('offers many looks and many tones', () => {
    expect(LOOKS.length).toBeGreaterThanOrEqual(10)
    expect(TONES.length).toBeGreaterThanOrEqual(15)
    for (const look of LOOKS) expect(createVideoStyle({ ...DEFAULT_STYLE, look }).ok).toBe(true)
    for (const tone of TONES) expect(createVideoStyle({ ...DEFAULT_STYLE, tone }).ok).toBe(true)
  })

  it('only knows the looks, tones and sounds the videos can do', () => {
    const style = createVideoStyle({ look: 'vaporwave', tone: 'angry', sound: 'opera' })

    expect(style.ok ? [] : style.error.violations).toEqual([
      "« vaporwave » n'est pas une direction artistique connue.",
      "« angry » n'est pas un ton connu.",
      "« opera » n'est pas un choix de son connu.",
    ])
  })
})

describe('VideoSetup', () => {
  it('has Claude direct each video by default, with no demo and no music', () => {
    expect(VideoSetup.default().props).toEqual(setup())
  })

  it('makes videos one of the two ways it knows', () => {
    const quick = VideoSetup.create(setup({ production: 'template' }))

    expect(quick.ok && quick.value.props.production).toBe('template')
    expect(violations({ production: 'by hand' })).toEqual(["« by hand » n'est pas une façon de fabriquer une vidéo."])
  })

  it('films up to three pages the user lists, each given once', () => {
    const created = VideoSetup.create(setup(demo('pages', [' http://localhost:5173 ', 'http://localhost:5173', '', 'https://example.com/jouer'])))

    expect(created.ok && created.value.props.demo.addresses).toEqual(['http://localhost:5173', 'https://example.com/jouer'])
    expect(violations(demo('pages', []))).toEqual(['Indiquez au moins une page à montrer.'])
    expect(violations(demo('pages', ['http://a.test', 'http://b.test', 'http://c.test', 'http://d.test']))).toEqual(['La démo montre 3 pages au plus.'])
  })

  it('needs to know where the application runs to let Claude pick the pages', () => {
    const auto = VideoSetup.create(setup(demo('auto', ['http://localhost:5173'])))

    expect(auto.ok && auto.value.props.demo).toEqual({ mode: 'auto', addresses: ['http://localhost:5173'] })
    expect(violations(demo('auto', []))).toEqual(["Indiquez l'adresse où tourne votre application (une seule)."])
    expect(violations(demo('magic', []))).toEqual(["« magic » n'est pas une façon de montrer l'application."])
  })

  it('only films what a browser can open, and keeps no address when there is no demo', () => {
    expect(violations(demo('pages', ['localhost:5173', 'file:///etc/passwd']))).toEqual([
      "« localhost:5173 » n'est pas une adresse web (ex. http://localhost:3000).",
      "« file:///etc/passwd » n'est pas une adresse web (ex. http://localhost:3000).",
    ])
    const none = VideoSetup.create(setup(demo('none', ['http://localhost:5173'])))
    expect(none.ok && none.value.props.demo.addresses).toEqual([])
  })

  it('turns the pages Claude picks into addresses of the application, and of nothing else', () => {
    const pages = ['/', 'defi', '/defi', 'https://elsewhere.test/x', '//elsewhere.test', '/a', '/b']

    expect(demoPagesOn('http://localhost:5173/app/', pages)).toEqual(['http://localhost:5173/', 'http://localhost:5173/app/defi', 'http://localhost:5173/defi'])
    expect(demoPagesOn('not an address', ['/'])).toEqual([])
  })
})

describe('VideoDirection', () => {
  it('is a persona’s style, with what the project’s videos share', () => {
    const shared = VideoSetup.create(setup({ ...demo('auto', ['http://localhost:5173']), track: '/home/ada/Music/beat.mp3' }))
    if (!shared.ok) throw new Error('fixture')

    const direction = VideoDirection.of({ look: 'neon', tone: 'dare', sound: 'track' }, shared.value)

    expect(direction.props).toEqual({
      look: 'neon',
      tone: 'dare',
      sound: 'track',
      track: '/home/ada/Music/beat.mp3',
      demo: { mode: 'auto', addresses: ['http://localhost:5173'] },
      production: 'directed',
    })
    expect(direction.showsDemo).toBe(true)
  })

  it('only carries the music file when the persona’s video plays it', () => {
    const shared = VideoSetup.create(setup({ track: '/home/ada/Music/beat.mp3' }))
    if (!shared.ok) throw new Error('fixture')

    expect(VideoDirection.of({ look: 'neon', tone: 'dare', sound: 'beat' }, shared.value).props.track).toBeNull()
    // Without a file, asking for one's own music leaves the effects alone.
    expect(VideoDirection.of({ look: 'neon', tone: 'dare', sound: 'track' }, VideoSetup.default()).props).toMatchObject({ sound: 'effects', track: null })
    expect(VideoDirection.default().props).toMatchObject(DEFAULT_STYLE)
  })
})
