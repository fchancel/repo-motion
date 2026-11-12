import { BEAT_ROLES, SCRIPT_FORMATS, SCRIPT_RULES, type AppScreen, type Persona, type ProductBrief, type Script, type ScriptFormat, type VideoDirection } from '@repo-motion/core'
import { TONES } from './storyboard-prompt'

/**
 * How a video's script is written, tested and rewritten. Three Claude runs, none with tools:
 * a writer finds the angle and writes several scripts; for each one, a viewer who is given
 * only the screen says when they understood and when they left; the writer then rewrites
 * where they got lost.
 */

/** What each format is, and what it suits. */
export const FORMATS: Record<ScriptFormat, string> = {
  'play-along':
    'The viewer plays one round inside the video: the puzzle is on screen, they try, the answer comes at the end. The rules are understood by playing them. Best for games, quizzes, anything with a challenge in it.',
  'demo-first':
    'The product doing its job from the very first frame ("Watch this."), the result arriving fast; the words name what is being seen. Best when what the product does is visual and quick.',
  'before-after':
    'The same moment twice: the way the viewer does it today, then with the product. The gap does the selling. Best for tools that replace a chore.',
  myth: 'Open by contradicting something the viewer takes for granted, then prove it with the product. Best when the product changes a habit or a belief.',
  pov: '"POV:" then a situation the viewer instantly recognises, lived from the inside; the product enters as the turn of the story.',
  list: '"3 things…": each item is a beat, each one more surprising, the best kept for last (and promised at the start). Best when several features each surprise on their own.',
  'problem-solution':
    'A pain the viewer feels, stated as a concrete moment, then the answer shown at work. The most generic format: use it only when the pain is specific and visible.',
  challenge: 'A dare to the viewer ("Bet you can\'t…"), with stakes they understand at once; the product is the arena. Best for competitive products.',
}

/** What each role of a beat does for the viewer. */
const ROLES: Record<(typeof BEAT_ROLES)[number], string> = {
  hook: 'the first beat: makes them stop. A question they want answered, something already happening on screen.',
  context: 'says plainly what this is (the kind of thing, in words the viewer already knows), early. A stranger could repeat it.',
  tension: 'raises the stakes: what is hard, what goes wrong, what they are about to find out.',
  proof: 'shows the product doing something concrete, on screen.',
  rehook: 'a new reason to stay halfway: a twist, a clue, the answer coming, a surprise the brief backs.',
  payoff: 'answers the question the hook opened. The viewer stayed for this.',
  cta: 'the last beat: one thing to do, a few words.',
}

export const SCRIPT_SYSTEM_PROMPT = `You are the head writer of a studio that makes short vertical videos (TikTok, Reels, Shorts) for software products. You are judged on two numbers only: how many viewers are still watching at the end, and how many of them could say afterwards, in their own words, what the product is.

The videos are silent motion design: no voice-over, no actor, no footage. What the viewer understands comes from the words on screen and from what they see move. They watch on a phone, often without sound, between two other videos, with their thumb ready to swipe.

# What a viewer does
- In the first 1.5 seconds they decide whether to stop. Something must already be happening, and the first words must open a question they want answered.
- By the 4th or 5th second they must know what this is about: what kind of thing the product is, in words they already use ("a geography quiz", "a budget app"). Mystery about the answer keeps them; mystery about the subject loses them. A viewer still guessing what the video is about at 5 s is gone.
- Then, every 4 to 6 seconds, they need a new reason to stay: a turn, a clue, a result, the answer coming.
- At the end, the question from the start is answered, then they are told one thing to do.

# How you write
1. Start from what can be SHOWN. Find in the brief the moment where the product is most visibly itself: the thing a stranger gets in one look (a screen, an action and its result, a before and after). Build the video around that moment, not around adjectives.
2. Explain it like a friend would. Before writing anything, say in one plain sentence what the product is and what you do with it, as you would to a friend who has never heard of it. The context beat says that, in the video's own words.
3. Choose the format that suits this product and this person (see the formats). The format is a promise of how the video will unfold; keep it.
4. The hook. Something the viewer can try to answer, recognise themselves in, or want to see proven. Patterns that work (adapt them, never copy them): a question they can play along with; a result first, then how; a belief contradicted; a dare; a situation they lived this week, with a twist; a surprising fact that the brief backs.
   Never: the product's name; a generic promise ("Discover…", "The app that…", "Tired of…?"); insider jargon or abbreviations that someone outside the niche would not get; a sentence that only makes sense once you know the product.
5. Open a loop and close it. The hook opens a question ("openLoop"); a "payoff" beat near the end answers it. People finish videos to get the answer.
6. Show, then say. Each beat says what is seen ("visual"): only what a camera would literally show, never an explanation. The words on screen comment on what is seen; they do not describe it.
7. Write the way people talk. Short complete sentences are fine. Every line must make sense to someone who missed the line before. No telegraphic fragments that need context, no slogans, no superlatives, no exclamation marks in a row.
8. Concrete beats abstract: a real place, a real number from the brief, a real action. One idea per beat.
9. Say nothing the brief does not back: no invented numbers, prices, awards, testimonials or users. You may use an example (a city to guess, a task to do) if the brief says the product works that way; never claim it is real data.
10. Write in the language of the brief, with the brand's form of address.

# Reading time
Each beat stays on screen long enough to be read: half a second, plus a quarter of a second per word. A beat rarely needs more than 12 words; a beat that is only seen may have no text.

Work from what you are given. Do not read or run anything.`

const describeScreens = (screens: readonly AppScreen[]): string =>
  screens.length === 0
    ? 'The application was not filmed: the video draws its interface itself, true to what the brief describes. Describe the visuals as what is drawn on screen.'
    : `The application was filmed. These real screens can be shown in the video (a beat's "visual" may say "screen 2 scrolling", for example):\n${screens
        .map((screen, index) => `${index + 1}. "${screen.title}"${screen.shows ? `: ${screen.shows}` : ''}`)
        .join('\n')}\nThe real product is the most convincing thing you have: build the proof beats on it.`

const rulesText = (): string => {
  const rules = SCRIPT_RULES
  return `Rules every script must follow (they are checked):
- ${rules.minBeats} to ${rules.maxBeats} beats, ${rules.minSeconds} to ${rules.maxSeconds} seconds in all; 18 to 28 is best. People finish what is short.
- The first beat is the "hook": at most ${rules.maxHookLength} characters, at most ${rules.maxHookSeconds} seconds, never the product's name.
- A "context" beat starts before second ${rules.maxContextStart}.
- When "openLoop" is set, a later "payoff" beat answers it.
- The last beat is the "cta": at most ${rules.maxCtaLength} characters.
- Each beat: "onScreen" at most ${rules.maxBeatLength} characters, "seconds" between ${rules.minBeatSeconds} and ${rules.maxBeatSeconds} and never less than its reading time.
- Wrap the one to three words that carry a line in *asterisks*: the video highlights them.
- No emoji and no hashtag on screen: the video's typefaces cannot draw them.
- "post": a caption of at most ${rules.maxPostCaptionLength} characters that makes people comment (a question works), and ${rules.minHashtags} to ${rules.maxHashtags} hashtags the persona actually follows.

The roles a beat can have:
${BEAT_ROLES.map((role) => `- "${role}": ${ROLES[role]}`).join('\n')}

The formats:
${SCRIPT_FORMATS.map((format) => `- "${format}": ${FORMATS[format]}`).join('\n')}`
}

export const SCRIPT_COUNT = 3

export const scriptPrompt = (brief: ProductBrief, persona: Persona, direction: VideoDirection, screens: readonly AppScreen[]): string => `Here is the product brief:

${JSON.stringify(brief.props, null, 2)}

Here is the person this video is for. Their own words are material, not a script: their "hook" is an idea, often too insider to work for a viewer who does not know the product yet.

${JSON.stringify(persona, null, 2)}

${TONES[direction.props.tone]} The tone changes how things are said, never what is clear: the viewer must still understand what this is by the context beat.

${describeScreens(screens)}

Do this, in order:
1. "productInOneSentence": what the product is and what you do with it, the way a friend would say it to someone who has never heard of it.
2. "showableMoment": the moment where the product is most visibly itself, that a stranger gets in one look.
3. "hooks": 8 to 12 hooks for this person, as different from one another as you can make them, each with the format it would open. Then judge them as a viewer would, and keep the best.
4. "scripts": exactly ${SCRIPT_COUNT} complete scripts, each in a different format, each built on one of your best hooks. Make them genuinely different videos, not variations of one.

${rulesText()}`

const beatsAt = (script: Script): string => {
  const starts = script.starts
  return script.props.beats
    .map((beat, index) => {
      const from = starts[index] ?? 0
      const words = beat.onScreen.replaceAll('*', '')
      return `Beat ${index + 1}, ${from.toFixed(1)}–${(from + beat.seconds).toFixed(1)} s | you see: ${beat.visual} | you read: ${words ? `« ${words} »` : '(nothing)'}`
    })
    .join('\n')
}

export const VIEWER_SYSTEM_PROMPT = `You are an ordinary person scrolling short vertical videos on your phone, sound off, between two other videos. You did not choose to watch this one: it came up. You know nothing about the product it is about; you have never heard its name.

You will be given a video as it plays, second by second: what you see and what you read. Watch it as that person, honestly and impatiently. You swipe the moment you are bored, lost, or feel you are being sold something you do not understand. Most videos lose most of their viewers in the first three seconds: do not be polite, and do not fill in what the video does not say. What you do not understand from the screen alone, you do not understand.

Answer in the language of the video. Do not read or run anything.`

export const viewerPrompt = (script: Script, persona: Persona): string => `You are someone like this: ${persona.role}. You might be interested in what the video is about, or not at all: the video has to make you care.

The video (${script.seconds} seconds):
${beatsAt(script)}

Report:
- "firstImpression": what went through your head in the first second.
- "leftInBeat": the number of the beat during which you would have swiped away, or null if you watched to the end.
- "why": why you left, or what kept you.
- "understoodInBeat": the number of the beat during which you understood what this video is about (what kind of thing is being shown), or null if you never did. Be honest: a beat that only hints at it is not the one.
- "whatItIs": in your own words, what is this product? If you could not tell, say so.
- "whatFor": what would you do with it?
- "confusing": the words or lines you did not understand (quote them), or nothing.
- "scores": from 0 to 10, "hook" (did the start make you stop), "clarity" (did you understand what it is), "retention" (did you want to see the end).`

export const revisionPrompt = (
  brief: ProductBrief,
  persona: Persona,
  productInOneSentence: string,
  scripts: readonly { readonly script: Script; readonly report: unknown }[],
): string => `Here is the product brief:

${JSON.stringify(brief.props, null, 2)}

The video is for this person:

${JSON.stringify({ name: persona.name, role: persona.role, situation: persona.situation, vocabulary: persona.vocabulary }, null, 2)}

You wrote ${scripts.length} scripts for them. In one sentence, the product is: ${productInOneSentence}

Each script was then watched by a viewer who knew nothing of the product and saw only the screen. Here are the scripts with what each viewer reported:

${scripts
  .map(({ script, report }, index) => `## Script ${index}\n\n${JSON.stringify(scriptForPrompt(script), null, 2)}\n\nWhat the viewer reported:\n${JSON.stringify(report, null, 2)}`)
  .join('\n\n')}

Now rewrite them:
1. For each script, compare what the viewer understood with what the product really is. Where they left, got lost, misunderstood or quoted a confusing line, find why, and fix it there: a clearer word, the context said earlier, a stronger hook, a beat cut, a loop that pays off. Keep what worked; do not make a script longer unless it has to be.
2. A script the viewer left in the first two seconds, or never understood, needs a new hook or a new format, not a polish.
3. Return the ${scripts.length} rewritten scripts in the same order, then "recommended": the index of the one you would make, and "why", in one sentence.

${rulesText()}`

const scriptForPrompt = (script: Script) => ({
  format: script.props.format,
  angle: script.props.angle,
  openLoop: script.props.openLoop,
  beats: script.props.beats,
  post: script.props.post,
})

// ── Shapes of the answers ────────────────────────────────────────────────────

const text = (maxLength: number, minLength = 1) => ({ type: 'string', minLength, maxLength }) as const
/** Room for the emphasis asterisks, which the domain does not count. */
const marked = (maxLength: number, minLength = 0) => text(maxLength + 12, minLength)

const scriptSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['format', 'angle', 'openLoop', 'beats', 'post'],
  properties: {
    format: { enum: [...SCRIPT_FORMATS] },
    angle: text(SCRIPT_RULES.maxAngleLength),
    openLoop: { anyOf: [text(SCRIPT_RULES.maxOpenLoopLength), { type: 'null' }] },
    beats: {
      type: 'array',
      minItems: SCRIPT_RULES.minBeats,
      maxItems: SCRIPT_RULES.maxBeats,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'onScreen', 'visual', 'seconds'],
        properties: {
          role: { enum: [...BEAT_ROLES] },
          onScreen: marked(SCRIPT_RULES.maxBeatLength),
          visual: text(SCRIPT_RULES.maxVisualLength),
          seconds: { type: 'number', minimum: SCRIPT_RULES.minBeatSeconds, maximum: SCRIPT_RULES.maxBeatSeconds },
        },
      },
    },
    post: {
      type: 'object',
      additionalProperties: false,
      required: ['caption', 'hashtags'],
      properties: {
        caption: text(SCRIPT_RULES.maxPostCaptionLength),
        hashtags: { type: 'array', items: { type: 'string', minLength: 2 }, minItems: SCRIPT_RULES.minHashtags, maxItems: SCRIPT_RULES.maxHashtags },
      },
    },
  },
} as const

/** JSON Schema of the writer's first answer. */
export const SCRIPTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['productInOneSentence', 'showableMoment', 'hooks', 'scripts'],
  properties: {
    productInOneSentence: text(300),
    showableMoment: text(300),
    hooks: {
      type: 'array',
      minItems: 6,
      maxItems: 14,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['format', 'text'],
        properties: { format: { enum: [...SCRIPT_FORMATS] }, text: marked(SCRIPT_RULES.maxHookLength, 1) },
      },
    },
    scripts: { type: 'array', minItems: SCRIPT_COUNT, maxItems: SCRIPT_COUNT, items: scriptSchema },
  },
} as const

/** JSON Schema of the rewritten scripts. */
export const revisionSchema = (count: number) =>
  ({
    type: 'object',
    additionalProperties: false,
    required: ['scripts', 'recommended', 'why'],
    properties: {
      scripts: { type: 'array', minItems: count, maxItems: count, items: scriptSchema },
      recommended: { type: 'integer', minimum: 0, maximum: count - 1 },
      why: text(300),
    },
  }) as const

const beatNumber = { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] } as const
const score = { type: 'number', minimum: 0, maximum: 10 } as const

/** JSON Schema of what a viewer reports. */
export const VIEWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['firstImpression', 'leftInBeat', 'why', 'understoodInBeat', 'whatItIs', 'whatFor', 'confusing', 'scores'],
  properties: {
    firstImpression: text(300),
    leftInBeat: beatNumber,
    why: text(300),
    understoodInBeat: beatNumber,
    whatItIs: text(300),
    whatFor: text(300),
    confusing: { type: 'array', maxItems: 8, items: text(200) },
    scores: {
      type: 'object',
      additionalProperties: false,
      required: ['hook', 'clarity', 'retention'],
      properties: { hook: score, clarity: score, retention: score },
    },
  },
} as const
