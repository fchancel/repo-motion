# How this studio works

You are directing one short vertical video, and you write it as code. This folder is your
workspace: you may read and write anything in it, and nothing outside it.

## What you write

- `src/Video.tsx`: the video. It must have a default export, a React component that
  receives `PieceProps`, and `export const DURATION_SECONDS = <number>`. You may add as
  many other files as you like under `src/` and import them.
- `sound.json`: what is heard (see "Sound"). Leave it out for a silent video.

The video is 1080 x 1920 at 30 frames per second, drawn with [Remotion](https://www.remotion.dev):
every frame is a pure function of `useCurrentFrame()`. That is the one rule that cannot
bend: no `setTimeout`, no CSS animation or transition, no `Math.random()` (use `random(seed)`
from `remotion`), nothing that depends on real time. Use `interpolate`, `spring`, `Easing`,
`Sequence`, `Series`, `AbsoluteFill`, `Img`, `random` and SVG. `@remotion/transitions` is
available too. Take sizes from `WIDTH`, `HEIGHT` and `FPS` of the kit rather than from
`useVideoConfig()`: on a sheet your video is drawn inside a larger picture.

You cannot install packages, download anything or use the network: there are no stock
images, no footage, no generated pictures. Everything on screen is drawn by your code
(shapes, type, SVG illustration, textures made with gradients and SVG filters) or comes
from the product itself (below). That is a constraint to design with, not around: great
motion design is made of exactly this.

## What you are given

`piece` (the props of your component) carries the product's own material:

- `piece.product.name`
- `piece.colors`: `primary`, and often `secondary`, `accent`, `background`, `text` (hex).
- `piece.logo`: the logo as a data URL, or `null`.
- `piece.fonts`: `display` (the product's own typeface when it has one), `body`, `serif`,
  `mono`. Each has a `family`; they are loaded before your first frame. Use them as
  `fontFamily: piece.fonts.display.family`. `display` and `body` have weights up to 800,
  `serif` has italics.
- `piece.screens`: pictures of the real application as it runs, taken on a phone-sized
  screen (data URLs, 780 px wide, as tall as the page). May be empty. When there are
  some, showing the real product is the most convincing thing the video can do.
- `piece.look`: the art direction asked for (your brief says what it means).

`BRIEF.md` tells you about the product, the person the video is for, the script (the
words read on screen and when, which you keep), the art direction and the tone.
`job.json` is the same material as data.

## The kit

`@kit` is optional. It holds things that are tedious to get right; anything you would
rather draw yourself, draw yourself.

```tsx
import { SAFE, SAFE_WIDTH, SAFE_HEIGHT, WIDTH, HEIGHT, FPS } from '@kit'
// SAFE = { left: 96, right: 96, top: 290, bottom: 500 }: see "Rules of the format".

import { makeTheme, alpha, mix, inkOn, contrast } from '@kit'
const theme = makeTheme(piece.colors, piece.fonts, piece.look)
// theme.bg, theme.text, theme.muted, theme.primary, theme.accents[], theme.flood, theme.onFlood,
// theme.display, theme.body (font-family strings). alpha('#3ff8ff', 0.3) -> rgba(). inkOn(theme, color)
// -> the ink that reads on that colour. contrast(a, b) -> WCAG ratio.

import { useFit, fit, Words, displayStyle, bodyStyle, ThemeProvider, emphasize } from '@kit'
// Fits a text to a box at the biggest size that holds, with balanced lines; *asterisks* mark
// the words to highlight. Words animates it word by word. Words must be inside a ThemeProvider.
const fitted = useFit('Tu *décroches* au bout de 5 minutes ?', displayStyle(theme), { width: SAFE_WIDTH, height: 700, max: 170, min: 70 })
<ThemeProvider value={theme}>
  <Words fitted={fitted} color={theme.text} emphasis={emphasize(theme, 'box', theme.primary)} at={10} stagger={2.4} />
</ThemeProvider>
// fitted.size (px), fitted.lines (tokens per line), fitted.height: use them to lay text out yourself.

import { LogoTile, Icon, Phone, phoneSize, Vignette, VIGNETTE, Stage, Flood } from '@kit'
<LogoTile theme={theme} logo={piece.logo} name={piece.product.name} size={280} />   // the logo on an app-icon tile
<Icon name="search" size={160} color={theme.primary} at={12} />                    // a line pictogram that draws itself
// names: bolt target clock calendar chart users lock shield sparkles map-pin globe trophy heart search chat bell
// wallet camera code gamepad book gift rocket eye share star music cart file languages video wand check coins
// layers mic pen image flag puzzle
<Phone screens={piece.screens} at={30} frames={120} glow={theme.primary} />          // the real app scrolling in a phone
// phoneSize() -> { width, height } it takes in the layout.
<Vignette visual={{ type: 'counter', items: ['5 000', 'points'] }} icon="target" theme={theme} accent={theme.primary} at={20} />
// a small animated interface, 888 x 540: search checklist chart counter map chat leaderboard timer toggles document share cards
```

The kit's source is not in your workspace; this page is its documentation.

## Looking at your work

You cannot watch the video, but you can look at it:

- `node {{SHEET}}` draws twelve moments of the whole video side by side into
  `review/sheet.png`. `node {{SHEET}} 3.5 7` does the same between two times, to see how
  something moves.
- `node {{STILL}} 4.2` draws the frame at 4.2 s, larger, into `review/still-4.2.png`.

Then open the picture with the Read tool. If your code does not compile or throws, the
command tells you what is wrong instead: fix it and run it again. These two commands are
the only ones you can run.

Look often. A sheet takes a few seconds; a video judged only in your head is a guess.
A sheet of the whole video shows what each shot looks like; it says nothing about how
things move. For every entrance, exit and transition that matters, draw a sheet over
that one second and read it as the frames of a film: nothing should jump, overlap by
accident or sit half-way at the moment it is meant to be read.

## Sound

`sound.json` lists what is heard, at the times your animation does it. Times are in
seconds. Everything is synthesised: there is no recorded music and no voice.

```json
{
  "music": "beat",
  "dropAt": 6.4,
  "events": [
    { "at": 0.0, "sound": "whoosh" },
    { "at": 0.4, "sound": "pop", "pitch": 1.2 },
    { "at": 5.6, "sound": "riser", "seconds": 0.8 },
    { "at": 6.4, "sound": "impact" }
  ]
}
```

- `sound`: `whoosh` (something sweeps in), `swish` (something sweeps out), `pop` (a
  word or an object lands), `tick` (a small detail), `thud` (something heavy lands),
  `impact` (the big moment: use it once or twice), `riser` (tension building up to a
  moment, lasting `seconds`), `click` (a button), `bell`, `sparkle` (a run of bells:
  something delightful).
- Optional on any event: `gain` (0 to 1, default depends on the sound), `pitch` (0.5 to
  2, default 1), `pan` (-1 left to 1 right).
- `music`: `"beat"` for a rhythm under the effects, `"none"` for effects alone. With a
  beat, `dropAt` is the moment the rhythm comes in fully (usually when the product
  appears); before it, the beat is held back.

Whether the video has sound at all is the user's choice, given in your brief. Write
`sound.json` when it does: one sound for each thing that visibly lands, sweeps or clicks,
and none for things that do not.

## Rules of the format

- Platforms cover parts of the frame: their tabs over the top 290 px, the caption and
  buttons over the bottom 500 px. Anything that must be read stays inside
  `x: 96..984, y: 290..1420` (`SAFE`). Backgrounds and decoration fill the whole frame.
- It is watched on a phone, often without sound: every idea must be readable. Text that
  carries meaning is at least 54 px; headlines are 110 px and up. Leave a text on screen
  long enough to read it: about a quarter of a second per word, plus half a second.
- The first frame is already interesting, and the first second gives a reason to stay.
- The last second holds still on the product's name and the call to action.
- Check contrast: text must read on what is behind it at every moment, including during
  transitions.
- Compose the whole frame. A shot whose content sits in the top third over an empty
  background looks unfinished: centre the subject in the safe area, make it bigger, or
  give the rest of the frame something to do.
- A text inside a shape you drew (a bubble, a label, a stamp, a button) must fit it with
  room to spare: size the shape from the text, or fit the text with `useFit`, and check
  it on a still.
