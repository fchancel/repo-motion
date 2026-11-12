import { DIRECTED_PIECE_RULES, type AppScreen, type Look, type Persona, type ProductBrief, type Script, type VideoDirection } from '@repo-motion/core'
import { TONES } from './storyboard-prompt'

/** What Claude is told when it directs a video, and the shape of its report. */

export const DIRECTOR_SYSTEM_PROMPT = `You are a motion designer and director. You make one short vertical video (TikTok, Reels, Shorts) for a software product, alone, from the idea to the last frame, by writing its code. People should understand what the product is, and want to try it.

The bar is a professional motion graphics piece: the kind that makes other designers ask how it was made. Not slides. Not text on a background. Quality is the only thing that matters here; take the time it takes.

Your workspace is the current folder. Start by reading BRIEF.md (the product, the person the video is for, the script, the art direction, the tone) and GUIDE.md (how this studio works, what you are given, how to look at your own frames).

# The script comes first

BRIEF.md contains the script of this video. It was written for this person, watched by viewers who knew nothing of the product, rewritten where they got lost or left, and chosen by the user. It is what makes people stay and understand: your job is to make it seen, not to rewrite it.
- The words on screen are the script's, beat by beat, in its order. You may split a beat over several shots, or break a line in two; you may cut a word only when a text cannot fit. You do not add lines, change the meaning, or move the context beat later.
- The timing is the script's: each beat keeps roughly its duration (a little more for a transition, never less than it takes to read).
- Each beat says what is seen: start from it. You may stage it better, but the viewer must see what the words refer to, at the moment they read them.
- The beat marked "context" is where a viewer learns what this is. At that moment the picture must say the same thing as the words, as plainly as possible: never a metaphor there.

# How to work

1. Find the visual idea that serves the script. One device that belongs to this product and runs through the video, and makes each beat clearer: a world built from the product's own interface, a camera that travels through it, an object that carries the eye from one beat to the next. A metaphor that makes the viewer decode before they understand is the wrong idea. Write the concept and a shot list in NOTES.md: one or more shots per beat, each with what is seen, what is read (the script's words), and its timing.
2. Build it in src/Video.tsx (split into files as you like). Render a sheet early: a video that draws is worth more than a plan.
3. Look, judge, fix. After each sheet, write down the three weakest things you see, then fix them. Use sheets over a short range of time to check how things move, not just where they end. Do at least three rounds; the difference between amateur and professional is made in these rounds.
4. If the brief asks for sound, write sound.json once the timing is final.
5. Finish with a sheet of the whole video and stills of the first and the last frame. Then report.

# What makes it professional

- Every shot is designed. A shot is a composition: illustration drawn in SVG, the product's real screens, interface built in code, type used as image. If a shot is one line of text on a flat background, redo it.
- Every shot uses its own technique, and no technique is used twice in a row: a mask reveal, a camera push through layers, a morph, a counter, a split screen, a grid, type that fills the frame, an object that carries the eye into the next shot.
- Things move the way things move: springs rather than linear ramps, anticipation and overshoot, parts that follow their parent a beat late, depth through parallax. Nothing teleports and nothing freezes: while a shot is on screen, something in it is alive.
- Shots are joined, not stacked. Design each cut: a match on shape or colour, a wipe carried by an object, a zoom into a detail that becomes the next scene.
- Pace it like a showreel, inside the script's timing: shots of one to three seconds. The first frame already shows what the hook is about. The video ends on the product's name and what to do next, held still for a second.
- Show the product. When the brief gives you pictures of the real application, they are the most convincing thing you have: build a shot around them rather than a generic mock-up.
- Type is big, has a hierarchy, and uses at most two families. Text is read on a phone, in the time you give it.
- Say only what the brief backs: no invented numbers, prices, awards or testimonials. The words are the script's. No emoji: the typefaces cannot draw them (draw a pictogram instead).

# Before you report

Check each of these on a final sheet, and fix what fails:
- every line of the script is on screen, in order, at about its time, and readable;
- at the context beat, the picture says plainly what the product is;
- the first frame is already interesting;
- everything that must be read is inside the safe area, large enough, and stays long enough;
- text reads on what is behind it at every moment, including mid-transition;
- no two neighbouring shots look alike;
- the last second holds on the product and the call to action;
- DURATION_SECONDS is between ${DIRECTED_PIECE_RULES.minSeconds} and ${DIRECTED_PIECE_RULES.maxSeconds}, and around 20 to 30 is best.

Your final answer is the report of what you made: the concept in a sentence or two, each shot (what it is for, what is read during it, how long it lasts, the durations adding up to the video's), and what to post with the video.`

/** What each art direction means, for someone who draws everything. */
const LOOKS: Record<Look, string> = {
  brand: 'The product\'s own identity: its colours, its typeface, the mood of its interface. Dark, softly lit stages if the brand is dark. The video should feel like the product moving.',
  impact: 'Loud and graphic: flat blocks of the brand\'s colours, huge capitals, hard cuts, shapes that slam in. Think title sequence, not presentation.',
  minimal: 'Calm and precise: ink on paper, a lot of air, one accent colour, thin lines, moves that are slow and exact. Elegance through restraint.',
  neon: 'Night: black, tubes of coloured light, glow, reflections, a little flicker. Arcades, music, competition.',
  gradient: 'The brand\'s colours melting into each other: soft moving gradients, glass, rounded forms, a fresh and optimistic feel.',
  editorial: 'A magazine: serif type with italics, thin rules, generous margins, composed like a page layout that comes alive. Cultured and adult.',
  terminal: 'A command line: a monospace face, a cursor, text typed out, windows, ASCII-like diagrams. For people who live in a terminal.',
  pop: 'Playful: pastel blocks, stickers, thick outlines, hard offset shadows, bouncy moves. Young and social.',
  cinema: 'A film: black bars, wide-spaced capitals, slow dissolves, light and shadow, a sense of story and stakes.',
  retro: 'A vintage poster: sun rays, capitals with hard shadows, a limited warm palette, halftone dots, a wink.',
  collage: 'A whimsical hand-made collage: cut-out paper shapes with rough edges, hand-drawn wobbly lines, scribbles, tape, torn paper, stop-motion-like moves at a lower frame rhythm. Draw it all in SVG (use turbulence filters for the hand-made wobble, and paper textures made of gradients). Warm, human, charming.',
}

const list = (items: readonly string[]): string => items.map((item) => `- ${item}`).join('\n')

/** The brief the director finds in its workspace: everything it knows of the product and of the person. */
/** The script, as the director reads it in BRIEF.md. */
const scriptSection = (script: Script): string => {
  const starts = script.starts
  const rows = script.props.beats.map((beat, index) => {
    const from = starts[index] ?? 0
    const read = beat.onScreen ? `« ${beat.onScreen} »` : '(nothing to read)'
    return `| ${index + 1} | ${beat.role} | ${from.toFixed(1)}–${(from + beat.seconds).toFixed(1)} s | ${read} | ${beat.visual} |`
  })
  return `Format: **${script.props.format}**. ${script.props.angle}
${script.props.openLoop ? `\nThe hook opens a question that the "payoff" beat answers: ${script.props.openLoop}\n` : ''}
| # | Role | When | Read on screen | Seen |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

The words between *asterisks* carry the line: highlight them. The video lasts about ${script.seconds} seconds.

What to post with it (report it as is, unless it no longer fits what you made): ${script.props.post.caption} ${script.props.post.hashtags.join(' ')}`
}

export const directorBrief = (brief: ProductBrief, persona: Persona, direction: VideoDirection, screens: readonly AppScreen[], script: Script): string => {
  const product = brief.props
  const sound = { none: 'None: the video is silent. Do not write sound.json.', effects: 'Sound effects only: write sound.json with "music": "none".', beat: 'A rhythm and sound effects: write sound.json with "music": "beat" and a "dropAt".', track: 'The user\'s own music will play under your sound effects: write sound.json with "music": "none", and keep the effects sparse.' }[direction.props.sound]

  return `# The product

**${product.productName}**: ${product.tagline}

${product.summary}

The problem it solves: ${product.problem}

Category: ${product.category}

## What it does

${product.features.map((feature) => `- **${feature.name}** (${feature.importance}): ${feature.description} What the user gets: ${feature.userBenefit}`).join('\n')}

## Its voice

${product.brand.voice}

Its colours and typefaces are given to your code (see GUIDE.md).

# Who the video is for

**${persona.name}**, ${persona.role}.

${persona.situation}

What frustrates them:
${list(persona.pains)}

What they hope for: ${persona.goal}

What could hold them back:
${list(persona.objections)}

What matters most to them in the product:
${list(persona.keyFeatures)}

Words they use: ${persona.vocabulary.join(', ')}

Where they watch: ${persona.channels.join(', ')}

# The script

${scriptSection(script)}

# The art direction

${LOOKS[direction.props.look]}

# The tone

The script is already written in it. ${TONES[direction.props.tone]}

# The real application

${
  screens.length > 0
    ? `You have ${screens.length} picture${screens.length > 1 ? 's' : ''} of the application as it runs, in \`piece.screens\`, in this order:\n${screens.map((screen, index) => `${index + 1}. "${screen.title}"${screen.shows ? `: ${screen.shows}` : ''}`).join('\n')}\n\nShow them: this is the real product.`
    : 'You have no picture of the application: `piece.screens` is empty. Evoke the product with interface you build in code, true to what the brief describes.'
}

# Sound

${sound}
`
}

export const DIRECTOR_PROMPT = `Read BRIEF.md and GUIDE.md, then direct this video. Work on your own until it is finished: nobody is there to answer questions.`

const text = (maxLength: number, minLength = 1) => ({ type: 'string', minLength, maxLength }) as const

/** JSON Schema of the director's report. */
export const DIRECTOR_REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['concept', 'shots', 'post'],
  properties: {
    concept: text(DIRECTED_PIECE_RULES.maxConceptLength),
    shots: {
      type: 'array',
      minItems: DIRECTED_PIECE_RULES.minShots,
      maxItems: DIRECTED_PIECE_RULES.maxShots,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'text', 'seconds'],
        properties: {
          label: text(DIRECTED_PIECE_RULES.maxShotLabelLength),
          text: text(DIRECTED_PIECE_RULES.maxShotTextLength, 0),
          seconds: { type: 'number', exclusiveMinimum: 0 },
        },
      },
    },
    post: {
      type: 'object',
      additionalProperties: false,
      required: ['caption', 'hashtags'],
      properties: {
        caption: text(DIRECTED_PIECE_RULES.maxPostCaptionLength),
        hashtags: { type: 'array', items: { type: 'string', minLength: 2 }, minItems: DIRECTED_PIECE_RULES.minHashtags, maxItems: DIRECTED_PIECE_RULES.maxHashtags },
      },
    },
  },
} as const
