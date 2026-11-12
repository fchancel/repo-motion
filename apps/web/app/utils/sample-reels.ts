import type { Reel } from './reel'

/**
 * Landing-page example: one fictional product (Quart, a staff-scheduling app),
 * three personas, three different videos. Each persona has its own hue.
 */
export const SAMPLE_PRODUCT = 'Quart'

export interface SampleReel {
  persona: string
  reel: Reel
}

export const SAMPLE_REELS: SampleReel[] = [
  {
    persona: 'Lucie, gérante de brasserie',
    reel: {
      brand: SAMPLE_PRODUCT,
      color: '#ff6b4a',
      hook: 'Encore deux heures perdues sur les plannings ?',
      demoTitle: 'Semaine 46',
      demoRows: ['Service du midi', 'Service du soir', 'Extras du week-end'],
      caption: 'Le planning de la semaine, prêt avant le service.',
      benefit: 'Le dimanche soir redevient un dimanche soir.',
      cta: 'Essayer Quart',
    },
  },
  {
    persona: 'Karim, gérant de salle de sport',
    reel: {
      brand: SAMPLE_PRODUCT,
      color: '#7c8cff',
      hook: 'Un coach absent, et tout le planning tombe ?',
      demoTitle: 'Cours de 18 h',
      demoRows: ['Coach indisponible', 'Proposer à Sarah', 'Prévenir les inscrits'],
      caption: 'Un remplaçant trouvé en deux touches.',
      benefit: 'Le cours a lieu. Personne ne remarque rien.',
      cta: 'Essayer Quart',
    },
  },
  {
    persona: 'Inès, responsable RH',
    reel: {
      brand: SAMPLE_PRODUCT,
      color: '#3ee6a8',
      hook: '40 salariés, zéro tableur.',
      demoTitle: 'Novembre',
      demoRows: ['Congés à valider', 'Absences du mois', 'Heures à exporter'],
      caption: 'Congés, absences, heures : un seul écran.',
      benefit: 'La paie part à l’heure, sans relance.',
      cta: 'Essayer Quart',
    },
  },
]

export const SAMPLE_HOOKS = [
  'Encore deux heures perdues sur les plannings ?',
  '40 salariés, zéro tableur.',
  'Un coach absent, et tout le planning tombe ?',
  'Vos factures partent toutes seules.',
  'Votre boutique, ouverte pendant que vous dormez.',
  'Trois clics, et le devis est signé.',
]
