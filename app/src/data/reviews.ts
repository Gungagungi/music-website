export interface SeedReview {
  productSlug: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
}

export const SEED_REVIEWS: SeedReview[] = [
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Julien P.',
    rating: 5,
    title: 'Le son Strat, sans compromis',
    body: 'Réglages d’usine impeccables, manche très confortable. Le micro chevalet claque exactement comme attendu.',
    createdAt: '2025-11-04T10:22:00.000Z',
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Sophie M.',
    rating: 4,
    title: 'Excellente, un chouïa lourde',
    body: 'Rien à redire sur la finition. Un peu de poids sur la sangle après deux heures de répétition.',
    createdAt: '2025-12-18T16:40:00.000Z',
  },
  {
    productSlug: 'harley-benton-st-62-vintage-series',
    author: 'Karim B.',
    rating: 5,
    title: 'Imbattable à ce prix',
    body: 'Un changement de cordes et un réglage de justesse, et elle tient tête à des instruments trois fois plus chers.',
    createdAt: '2026-01-21T19:05:00.000Z',
  },
  {
    productSlug: 'boss-ds-1-distortion',
    author: 'Léa T.',
    rating: 4,
    title: 'Un classique indémodable',
    body: 'Grain très reconnaissable. Idéale sur un ampli clair, un peu brouillonne sur un canal déjà saturé.',
    createdAt: '2025-09-30T11:15:00.000Z',
  },
  {
    productSlug: 'yamaha-fg800m',
    author: 'Antoine G.',
    rating: 5,
    title: 'La meilleure première acoustique',
    body: 'Table massive à ce tarif, projection surprenante. Je la recommande à tous mes élèves.',
    createdAt: '2026-02-11T08:48:00.000Z',
  },
];
