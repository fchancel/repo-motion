import { SCENE_ICONS, SCENE_VISUALS, STORYBOARD_RULES, type AppScreen, type Persona, type ProductBrief, type SceneVisual, type Script, type Tone, type VideoDirection } from '@repo-motion/core'

/** What Claude is asked to write for one persona's video, and the shape of its answer. */

export const STORYBOARD_SYSTEM_PROMPT = `You fit an approved script into the shots of a ready-made short video (TikTok, Reels, Shorts) for a software product.

The script was written for one person, watched by viewers who knew nothing of the product, rewritten where they got lost, and chosen by the user. Its words are the video: keep them. Your job is only to place them into the fixed shots below, changing as little as you can.

The video is silent kinetic typography: every word appears on screen in big type. Its shots, in order:
1. "hook": the script's hook, word for word.
2. "pain": the script's "tension" beats that come before its "context" beat, one line each. Usually there are none: then leave it empty. Never invent pain the script does not have: the sooner the viewer learns what this is, the longer they stay.
3. "reveal": the product's name and logo land (the video shows them). The line is the script's "context" beat: what this is, said plainly.
4. "features": one to three things the product does, taken from the script's "proof" and "rehook" beats. Name the feature of the brief each beat shows; its "title" and "caption" are that beat's words.
5. "benefit": the script's "payoff" beat, which answers the question the hook opened. Without one, the strongest line left.
6. "cta": the script's call to action.

How to fit:
- Copy the script's words. Shorten a line only when it is longer than its shot allows, and then cut words, never meaning.
- Keep the *asterisks* the script puts on the words that carry a line, or mark one to three words yourself where there are none.
- No emoji and no hashtag inside the video texts: the video's typefaces cannot draw them.
- Say nothing the brief or the script does not back.
- The "post" is the script's own: copy it.

Work from what you are given. Do not read or run anything.`

/** What each interface shows, and what the words given to it become. */
const VISUALS: Record<SceneVisual, string> = {
  search: 'someone searches. The first item is what they type, the next ones are the results that appear.',
  checklist: 'lines get ticked one after another. The items are the lines.',
  chart: 'bars grow, each taller than the last. The items are the bars\' labels, in order.',
  counter: 'a number counts up. The first item is the number as displayed ("5 000"), the second what it counts.',
  map: 'a pin drops on a globe. The first item, if any, is the label under the pin.',
  chat: 'messages pop up, alternating sides. The items are the messages.',
  leaderboard: 'a ranking where one line climbs to first place. The items are the names, the winner first.',
  timer: 'a ring counts down. The first item, if any, is its label.',
  toggles: 'settings switch on one by one. The items are the settings.',
  document: 'a text whose hidden words are revealed one by one. The items are the words revealed.',
  share: 'a link is copied and people join. The first item, if any, is the link; the next ones are names.',
  cards: 'cards fan out. The items are their titles. Only when nothing else fits.',
}

/** How each tone changes the writing. The facts never change: only the voice does. */
export const TONES: Record<Tone, string> = {
  brand: 'Write in the brand voice described in the brief.',
  friendly:
    'Tone: complicit. Write like a friend who found something and cannot keep it to themselves: warm, casual, a little teasing. Keep the form of address the brand uses.',
  expert:
    'Tone: expert. Calm and precise, like someone who knows the subject inside out: one concrete fact per line, no hype, no exclamation mark.',
  funny:
    'Tone: funny. An absurd but true observation in the hook, self-mockery in the pain, a punchline in the benefit. Never at the expense of the viewer.',
  pushy:
    'Tone: pushy. Direct, urgent, imperative. A dare in the hook, stakes in the pain, short orders, and a call to action that says to do it now. No invented scarcity, deadline or number: the pressure comes from the wording, never from a claim the brief does not back.',
  story:
    'Tone: storytelling. The video is one small story told in the present tense: a moment (the hook), what goes wrong (the pain), the turn (the reveal), what changes. Concrete details, one scene, no moral.',
  pov:
    'Tone: point of view. Write from inside the persona\'s head, the way "POV" videos do: the hook sets the situation they are in ("POV: ..." in the language of the brief), the pain is what they think, the benefit is what they feel. It is the persona\'s situation, never a customer quote or a testimonial.',
  provocative:
    'Tone: provocative. Open by contradicting something the persona takes for granted, and hold the position. Blunt, a little insolent, never insulting, and never against a named competitor or person.',
  dare:
    'Tone: dare. Challenge the viewer to do something and doubt, playfully, that they can. The hook is the dare, the features are the rules of the game, the call to action is "prove it". Nothing they could win or lose is invented.',
  inspiring:
    'Tone: inspiring. Speak to who the persona wants to become. Short, rising sentences; the benefit is a picture of them having succeeded. Sincere, never grandiose, no empty slogans.',
  teacher:
    'Tone: teacher. The video teaches one thing the persona did not know, and the product is how to apply it. The hook is the surprising fact or the question, each line explains simply, the benefit is what they can now do.',
  reassuring:
    'Tone: reassuring. Calm and kind. Name the worry without dramatising it, then remove the persona\'s objections one by one with what the product really does. No urgency, no pressure, no exclamation mark.',
  sober:
    'Tone: sober. As few words as possible, plainly said, almost dry. Statements, not sales. If a line can lose a word, it loses it. No adjective that is not a fact.',
  premium:
    'Tone: premium. Assured, restrained, elegant. Short declarative sentences, a chosen vocabulary, nothing familiar, no exclamation mark, no superlative: quality is shown by precision, not claimed.',
  ironic:
    'Tone: ironic. Deadpan. Say the opposite of what is meant in the hook and the pain, so that the persona recognises their own bad habits, then drop the irony at the reveal and speak plainly from there.',
  genz:
    'Tone: Gen Z. Written the way people in their early twenties post: short, lower-key, self-aware, with the slang the persona really uses in the language of the brief. Understated rather than excited. No emoji (the video cannot draw them), and no slang forced where it would sound like an adult imitating.',
  trailer:
    'Tone: film trailer. Solemn and oversized on purpose, like the voice of a trailer: a world set in the hook, a threat in the pain, a hero at the reveal. Played straight; the gap with the everyday subject is the charm.',
}

const demoBrief = (screens: readonly AppScreen[]): string => `

This video shows the real application. Right after the reveal, a "demo" shot films these pages scrolling in a phone:
${screens.map((screen, index) => `${index + 1}. "${screen.title}" (${screen.address})${screen.shows ? `, which shows: ${screen.shows}` : ''}`).join('\n')}
Write "demo": the caption read over that shot, at most ${STORYBOARD_RULES.maxDemoCaptionLength} characters. What is known of each page is given above: when a line says what the page shows, you may rely on it. For a page with only a title, the caption must be true whatever is on it: say that this is the real product and what using it feels like, never where something is on the screen.`

/** The script as the storyboard writer reads it: each beat with its role, what is seen and what is read. */
export const scriptAsText = (script: Script): string => {
  const starts = script.starts
  const beats = script.props.beats.map(
    (beat, index) => `${index + 1}. [${beat.role}] ${(starts[index] ?? 0).toFixed(1)} s, ${beat.seconds} s — seen: ${beat.visual} — read: ${beat.onScreen ? `« ${beat.onScreen} »` : '(nothing)'}`,
  )
  return [
    `Format: ${script.props.format}. ${script.props.angle}`,
    ...(script.props.openLoop ? [`Question opened by the hook: ${script.props.openLoop}`] : []),
    '',
    ...beats,
    '',
    `Post: ${script.props.post.caption} ${script.props.post.hashtags.join(' ')}`,
  ].join('\n')
}

export const storyboardPrompt = (brief: ProductBrief, persona: Persona, direction: VideoDirection, screens: readonly AppScreen[], script: Script): string => {
  const rules = STORYBOARD_RULES
  const longest = rules.maxSeconds + (direction.showsDemo ? rules.demoExtraSeconds : 0)
  return `Here is the product brief:

${JSON.stringify(brief.props, null, 2)}

The video is for ${persona.name}, ${persona.role}.

Here is the script the user chose:

${scriptAsText(script)}

Fit it into the shots. Where you must reword, keep its tone: ${TONES[direction.props.tone]}${direction.showsDemo ? demoBrief(screens) : ''}

- "hook": at most ${rules.maxHookLength} characters, and shorter is better: 6 to 10 words.
- "pain": 0 to ${rules.maxPainLines} lines, at most ${rules.maxLineLength} characters each. Empty unless the script has tension before its context.
- "reveal": at most ${rules.maxRevealLength} characters.
- "features": ${rules.minFeatures} to ${rules.maxFeatures} items, the ones that matter most to this persona. Two is right; a third only if the video would not make sense without it. For each:
  - "feature": the feature's name, copied exactly from the brief.
  - "icon": the pictogram that best illustrates it, among: ${SCENE_ICONS.join(', ')}.
  - "visual": the small interface that shows the feature in motion. "type" is one of the following, and "items" are the words written on it (at most ${rules.maxVisualItems}, at most ${rules.maxVisualItemLength} characters each, no asterisks):
${SCENE_VISUALS.map((visual) => `    - "${visual}": ${VISUALS[visual]}`).join('\n')}
    Pick the one closest to what the persona actually does with the feature, and a different one for each feature. Every item must be something the product really shows or says according to the brief: a number only if the brief gives it.
  - "title": at most ${rules.maxFeatureTitleLength} characters.
  - "caption": at most ${rules.maxCaptionLength} characters.
- "benefit": at most ${rules.maxBenefitLength} characters.
- "cta": at most ${rules.maxCtaLength} characters.
- "post.caption": at most ${rules.maxPostCaptionLength} characters, no hashtag inside.
- "post.hashtags": ${rules.minHashtags} to ${rules.maxHashtags} hashtags, each starting with #, without spaces.

Lengths are counted without the asterisks. Each word stays about a quarter of a second on screen, and each shot adds about a second: the whole video must last between ${rules.minSeconds} and ${longest} seconds, and around ${direction.showsDemo ? 24 : 20} is best. People finish what is short: when in doubt, cut a word, a line or a feature.`
}

const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength }) as const
/** Room for the emphasis asterisks, which the domain does not count. */
const marked = (maxLength: number) => text(maxLength + 12)

/** JSON Schema given to Claude Code: it validates the answer before handing it back. */
export const storyboardSchema = (direction: VideoDirection) => ({
  type: 'object',
  additionalProperties: false,
  required: ['hook', 'pain', 'reveal', ...(direction.showsDemo ? ['demo'] : []), 'features', 'benefit', 'cta', 'post'],
  properties: {
    ...(direction.showsDemo ? { demo: marked(STORYBOARD_RULES.maxDemoCaptionLength) } : {}),
    hook: marked(STORYBOARD_RULES.maxHookLength),
    pain: { type: 'array', items: marked(STORYBOARD_RULES.maxLineLength), minItems: 0, maxItems: STORYBOARD_RULES.maxPainLines },
    reveal: marked(STORYBOARD_RULES.maxRevealLength),
    features: {
      type: 'array',
      minItems: STORYBOARD_RULES.minFeatures,
      maxItems: STORYBOARD_RULES.maxFeatures,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['feature', 'icon', 'visual', 'title', 'caption'],
        properties: {
          feature: { type: 'string', minLength: 1 },
          icon: { enum: [...SCENE_ICONS] },
          visual: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'items'],
            properties: {
              type: { enum: [...SCENE_VISUALS] },
              items: { type: 'array', maxItems: STORYBOARD_RULES.maxVisualItems, items: text(STORYBOARD_RULES.maxVisualItemLength) },
            },
          },
          title: marked(STORYBOARD_RULES.maxFeatureTitleLength),
          caption: marked(STORYBOARD_RULES.maxCaptionLength),
        },
      },
    },
    benefit: marked(STORYBOARD_RULES.maxBenefitLength),
    cta: marked(STORYBOARD_RULES.maxCtaLength),
    post: {
      type: 'object',
      additionalProperties: false,
      required: ['caption', 'hashtags'],
      properties: {
        caption: text(STORYBOARD_RULES.maxPostCaptionLength),
        hashtags: {
          type: 'array',
          items: { type: 'string', minLength: 2 },
          minItems: STORYBOARD_RULES.minHashtags,
          maxItems: STORYBOARD_RULES.maxHashtags,
        },
      },
    },
  },
})
