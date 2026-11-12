import type { ProductBriefDraft } from '../domain/analysis/product-brief'
import type { PersonaDraft } from '../domain/persona/persona'
import type { DirectedPieceDraft } from '../domain/video/piece'
import type { ScriptDraft, ViewerTest } from '../domain/video/script'
import type { StoryboardDraft } from '../domain/video/storyboard'

export const aProductBriefDraft = (overrides: Partial<ProductBriefDraft> = {}): ProductBriefDraft => ({
  productName: 'Wiki Géo',
  tagline: 'Le jeu de géographie qui se joue en reliant des pages Wikipédia.',
  summary: "Un jeu web où l'on relie deux lieux en naviguant de lien en lien.",
  problem: 'Apprendre la géographie est souvent scolaire et ennuyeux.',
  category: 'Jeu éducatif',
  audiences: ['Lycéens', 'Amateurs de quiz'],
  features: [
    {
      name: 'Défi du jour',
      description: 'Un parcours commun à tous les joueurs chaque jour.',
      userBenefit: 'Se comparer à ses amis sur le même défi.',
      importance: 'core',
    },
  ],
  userJourneys: [{ name: 'Jouer le défi du jour', steps: ["Ouvrir l'accueil", 'Lancer le défi', 'Partager son score'] }],
  brand: {
    colors: { primary: '#1E40AF', accent: '#f59e0b' },
    fonts: ['Inter'],
    logoPath: 'public/logo.svg',
    voice: 'Ludique et tutoyant',
  },
  evidence: ['README.md', 'app/pages/index.vue'],
  ...overrides,
})

/** A persona that fits `aProductBriefDraft()`. */
export const aPersonaDraft = (overrides: Partial<PersonaDraft> = {}): PersonaDraft => ({
  name: 'Léa',
  role: 'Lycéenne en terminale',
  audience: 'Lycéens',
  situation: 'Elle révise le bac entre deux cours et décroche vite des fiches de géographie.',
  pains: ['Les fiches de révision m’endorment.'],
  goal: 'Réviser sans avoir l’impression de travailler.',
  objections: ['Encore une appli que je vais oublier.'],
  keyFeatures: ['Défi du jour'],
  vocabulary: ['le bac', 'réviser', 'la flemme'],
  hook: 'Réviser la géo en jouant ? Oui.',
  channels: ['tiktok', 'instagram'],
  rationale: 'Elle incarne les lycéens du brief : le défi du jour transforme ses révisions de géographie en un jeu court qu’elle peut faire chaque jour.',
  ...overrides,
})

/** A storyboard that fits `aProductBriefDraft()` and `aPersonaDraft()`. */
export const aStoryboardDraft = (overrides: Partial<StoryboardDraft> = {}): StoryboardDraft => ({
  scenes: [
    { kind: 'hook', text: 'Tu révises la géo et tu *décroches* au bout de 5 minutes ?' },
    { kind: 'pain', lines: ['Les fiches *t’endorment*.', 'Les cartes ne rentrent pas.'] },
    { kind: 'reveal', line: 'La géo qui se joue, *lien après lien*.' },
    { kind: 'feature', feature: 'Défi du jour', icon: 'calendar', visual: { type: 'checklist', items: ['Lieu 1', 'Lieu 2', 'Lieu 3'] }, title: 'Un *défi* par jour', caption: 'Le même parcours pour toute ta classe.' },
    { kind: 'benefit', text: 'Tu révises *sans t’en rendre compte*.' },
    { kind: 'cta', text: 'Joue le défi du jour' },
  ],
  post: {
    caption: 'Réviser la géo sans ouvrir une fiche, c’est possible.',
    hashtags: ['#bac', '#geographie', '#revision'],
  },
  ...overrides,
})

/** What a director reports of a video it made for `aPersonaDraft()`. */
export const aPieceDraft = (overrides: Partial<DirectedPieceDraft> = {}): DirectedPieceDraft => ({
  concept: 'Une fiche de révision qui s’ennuie, et qui se transforme en carte au trésor.',
  shots: [
    { label: 'Accroche', text: 'Tu décroches au bout de 5 minutes ?', seconds: 3 },
    { label: 'La fiche s’anime', text: 'Et si tu jouais ?', seconds: 5 },
    { label: 'Le défi du jour', text: 'Le même parcours pour toute ta classe.', seconds: 6 },
    { label: 'Appel à l’action', text: 'Joue le défi du jour', seconds: 4 },
  ],
  post: { caption: 'Réviser la géo sans ouvrir une fiche, c’est possible.', hashtags: ['#bac', '#geographie', '#revision'] },
  ...overrides,
})

/** A script that fits `aProductBriefDraft()`: a round played along, answered at the end. */
export const aScriptDraft = (overrides: Partial<ScriptDraft> = {}): ScriptDraft => ({
  format: 'play-along',
  angle: 'Léa joue une manche pendant la vidéo : elle comprend le jeu en y jouant.',
  openLoop: 'Où est cette ville ?',
  beats: [
    { role: 'hook', onScreen: 'Où est cette ville ? Tu as *5 secondes*.', visual: 'Une page Wikipédia dont le nom est caviardé', seconds: 2.5 },
    { role: 'context', onScreen: 'Une page Wikipédia, le *nom caché*. À toi de trouver.', visual: 'Les indices de la page se surlignent', seconds: 3 },
    { role: 'proof', onScreen: 'Le même *défi* pour toute ta classe.', visual: 'Le défi du jour, cinq lieux', seconds: 3 },
    { role: 'rehook', onScreen: 'Indice : un *fleuve* la traverse.', visual: 'Le mot « Rhône » se découvre', seconds: 2.5 },
    { role: 'payoff', onScreen: 'C’était *Lyon*. Tu l’avais ?', visual: 'Le repère tombe sur Lyon', seconds: 2.5 },
    { role: 'cta', onScreen: 'Joue le défi du jour', visual: 'Le logo et le bouton Jouer', seconds: 2.5 },
  ],
  post: { caption: 'Tu l’as trouvée en combien de secondes ?', hashtags: ['#bac', '#geographie', '#quiz'] },
  ...overrides,
})

/** What a viewer who understood quickly and stayed made of a script. */
export const aViewerTest = (overrides: Partial<ViewerTest> = {}): ViewerTest => ({
  whatItIs: 'Un jeu où il faut deviner une ville à partir de sa page Wikipédia.',
  whatFor: 'Y jouer chaque jour et comparer avec mes amis.',
  understoodAt: 3,
  leftAt: null,
  why: 'Je voulais savoir quelle ville c’était.',
  confusing: [],
  scores: { hook: 8, clarity: 8, retention: 7 },
  ...overrides,
})
