import type { DemoModeDto, LookDto, ProductionDto, SoundDto, ToneDto, VideoDirectionDto, VideoSetupDto, VideoStyleDto } from '#shared/types/api'

/** The words the interface uses for each choice a video can be made with. */

export const LOOK_OPTIONS: { value: LookDto; label: string; text: string }[] = [
  { value: 'brand', label: 'Marque', text: 'Scène sombre, lumières aux couleurs du produit' },
  { value: 'impact', label: 'Impact', text: 'Aplats de couleur, capitales, coupes franches' },
  { value: 'minimal', label: 'Épuré', text: 'Encre sur papier, mouvements calmes' },
  { value: 'neon', label: 'Néon', text: 'Tubes de lumière dans le noir' },
  { value: 'gradient', label: 'Dégradé', text: 'Vos couleurs qui se fondent' },
  { value: 'editorial', label: 'Magazine', text: 'Serif, italiques, filets fins' },
  { value: 'terminal', label: 'Terminal', text: 'Ligne de commande, texte tapé' },
  { value: 'pop', label: 'Pop', text: 'Pastels, autocollants, contours épais' },
  { value: 'cinema', label: 'Cinéma', text: 'Bandes noires, capitales espacées' },
  { value: 'retro', label: 'Rétro', text: 'Affiche, rayons de soleil, ombres dures' },
  { value: 'collage', label: 'Collage', text: 'Papiers découpés, traits à la main' },
]

export const TONE_OPTIONS: { value: ToneDto; label: string; text: string }[] = [
  { value: 'brand', label: 'Voix de la marque', text: 'Le ton relevé dans votre application.' },
  { value: 'friendly', label: 'Complice', text: 'Comme un ami qui partage un bon plan.' },
  { value: 'expert', label: 'Expert', text: 'Posé, précis, un fait par ligne.' },
  { value: 'funny', label: 'Drôle', text: 'Une observation absurde mais vraie, et une chute.' },
  { value: 'pushy', label: 'Pushy', text: 'Direct, urgent, à l’impératif. La pression vient des mots, jamais d’une fausse urgence.' },
  { value: 'story', label: 'Récit', text: 'Une petite histoire au présent : un moment, un problème, un tournant.' },
  { value: 'pov', label: 'POV', text: 'Depuis la tête du persona : sa situation, ce qu’il pense, ce qu’il ressent.' },
  { value: 'provocative', label: 'Provocateur', text: 'Contredit une idée reçue et tient sa position, sans insulter personne.' },
  { value: 'dare', label: 'Défi', text: 'Met le spectateur au défi, et doute gentiment qu’il y arrive.' },
  { value: 'inspiring', label: 'Inspirant', text: 'Parle à la personne que le persona veut devenir. Sincère, sans slogan creux.' },
  { value: 'teacher', label: 'Pédagogue', text: 'Apprend une chose au spectateur ; le produit sert à l’appliquer.' },
  { value: 'reassuring', label: 'Rassurant', text: 'Calme et bienveillant : lève les objections une à une, sans pression.' },
  { value: 'sober', label: 'Sobre', text: 'Le moins de mots possible, dits simplement.' },
  { value: 'premium', label: 'Premium', text: 'Assuré, retenu, élégant. Aucun superlatif.' },
  { value: 'ironic', label: 'Ironique', text: 'Pince-sans-rire : dit le contraire jusqu’à l’apparition du produit.' },
  { value: 'genz', label: 'Gen Z', text: 'Comme on poste à vingt ans : court, détaché, avec les mots du persona.' },
  { value: 'trailer', label: 'Bande-annonce', text: 'Solennel et démesuré exprès, comme la voix d’une bande-annonce.' },
]

export const SOUND_OPTIONS: { value: SoundDto; label: string; text: string }[] = [
  { value: 'none', label: 'Sans son', text: 'Vous ajoutez le son du moment en publiant' },
  { value: 'effects', label: 'Effets sonores', text: 'Un son sur chaque mouvement' },
  { value: 'beat', label: 'Rythme et effets', text: 'Une musique générée, qui démarre quand le produit apparaît' },
  { value: 'track', label: 'Votre musique', text: 'Un fichier audio de votre ordinateur, sous les effets' },
]

export const PRODUCTION_OPTIONS: { value: ProductionDto; label: string; text: string }[] = [
  {
    value: 'directed',
    label: 'Réalisée par Claude',
    text: 'Claude invente le concept, écrit toute l’animation sur mesure et se corrige en regardant ses propres images. 10 à 30 minutes par vidéo, et nettement plus de votre quota Claude.',
  },
  {
    value: 'template',
    label: 'Rapide',
    text: 'Claude écrit seulement le texte ; la vidéo est assemblée à partir de plans tout faits. 1 à 2 minutes par vidéo.',
  },
]

export const DEMO_OPTIONS: { value: DemoModeDto; label: string; text: string }[] = [
  { value: 'none', label: 'Ne pas la montrer', text: 'La vidéo reste en typographie animée' },
  { value: 'auto', label: 'Laisser Claude choisir les pages', text: 'Il lit le code et retient les pages qui parlent le plus à chaque persona' },
  { value: 'pages', label: 'Choisir les pages moi-même', text: 'Vous donnez les liens des pages à montrer' },
]

const label = <Value extends string>(options: { value: Value; label: string }[], value: Value): string =>
  options.find((option) => option.value === value)?.label ?? value

/** What a video was made with, in a few words. Choices left at their default are not listed. */
export const directionChips = (direction: VideoDirectionDto): string[] => [
  ...(direction.production === 'directed' ? ['Réalisée par Claude'] : []),
  ...(direction.look === 'brand' ? [] : [label(LOOK_OPTIONS, direction.look)]),
  ...(direction.tone === 'brand' ? [] : [label(TONE_OPTIONS, direction.tone)]),
  ...(direction.demo.mode === 'none' ? [] : [direction.demo.mode === 'auto' ? 'Démo choisie par Claude' : 'Démo de l’app']),
  ...(direction.sound === 'none' ? [] : [label(SOUND_OPTIONS, direction.sound)]),
]

/** The style in a few words, for a button or a sentence. */
export const styleSummary = (style: VideoStyleDto): string =>
  [label(LOOK_OPTIONS, style.look), label(TONE_OPTIONS, style.tone), label(SOUND_OPTIONS, style.sound)].join(', ')

/** True when a video made with `direction` is what `style` and `setup` would make now. */
export const madeWith = (direction: VideoDirectionDto, style: VideoStyleDto, setup: VideoSetupDto): boolean =>
  direction.production === setup.production &&
  direction.look === style.look &&
  direction.tone === style.tone &&
  // Asking for one's own music without a file gives sound effects.
  direction.sound === (style.sound === 'track' && !setup.track ? 'effects' : style.sound) &&
  (direction.sound !== 'track' || direction.track === setup.track) &&
  direction.demo.mode === setup.demo.mode &&
  direction.demo.addresses.join('\n') === setup.demo.addresses.join('\n')
