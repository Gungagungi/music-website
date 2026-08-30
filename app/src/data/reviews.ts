export interface SeedReview {
  productSlug: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  /** Seeded reviews describe past customers; most of them bought the instrument. */
  verifiedPurchase?: boolean;
}

export const SEED_REVIEWS: SeedReview[] = [
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Julien P.',
    rating: 5,
    title: 'Le son Strat, sans compromis',
    body: 'Réglages d’usine impeccables, manche très confortable. Le micro chevalet claque exactement comme attendu.',
    createdAt: '2025-11-04T10:22:00.000Z',
    verifiedPurchase: true,
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Sophie M.',
    rating: 4,
    title: 'Excellente, un chouïa lourde',
    body: 'Rien à redire sur la finition. Un peu de poids sur la sangle après deux heures de répétition.',
    createdAt: '2025-12-18T16:40:00.000Z',
    verifiedPurchase: true,
  },
  {
    productSlug: 'harley-benton-st-62-vintage-series',
    author: 'Karim B.',
    rating: 5,
    title: 'Imbattable à ce prix',
    body: 'Un changement de cordes et un réglage de justesse, et elle tient tête à des instruments trois fois plus chers.',
    createdAt: '2026-01-21T19:05:00.000Z',
    verifiedPurchase: true,
  },
  {
    productSlug: 'boss-ds-1-distortion',
    author: 'Léa T.',
    rating: 4,
    title: 'Un classique indémodable',
    body: 'Grain très reconnaissable. Idéale sur un ampli clair, un peu brouillonne sur un canal déjà saturé.',
    createdAt: '2025-09-30T11:15:00.000Z',
    verifiedPurchase: false,
  },
  {
    productSlug: 'yamaha-fg800m',
    author: 'Antoine G.',
    rating: 5,
    title: 'La meilleure première acoustique',
    body: 'Table massive à ce tarif, projection surprenante. Je la recommande à tous mes élèves.',
    createdAt: '2026-02-11T08:48:00.000Z',
    verifiedPurchase: true,
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Nadia R.',
    rating: 3,
    title: 'Bien, mais un réglage s’imposait',
    body: 'Action bien trop haute à la sortie du carton. Une fois passée chez un luthier, plus rien à redire.',
    createdAt: '2025-10-12T09:05:00.000Z',
    verifiedPurchase: true,
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Marc D.',
    rating: 5,
    title: 'Vingt ans que j’en rêvais',
    body: 'Le manche moderne C convient parfaitement à mes grandes mains. Les micros sont plus polyvalents que sur l’ancienne série.',
    createdAt: '2026-01-06T14:30:00.000Z',
    verifiedPurchase: true,
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Chloé V.',
    rating: 2,
    title: 'Frettes mal ébavurées sur mon exemplaire',
    body: 'Les bords de frettes accrochent la main en position haute. Le service après-vente a été correct, mais le contrôle qualité a laissé passer.',
    createdAt: '2025-08-19T17:52:00.000Z',
    verifiedPurchase: true,
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Hugo L.',
    rating: 4,
    title: 'Très bon rapport qualité-prix',
    body: 'Difficile de trouver mieux dans cette gamme. Je changerai peut-être les mécaniques à terme.',
    createdAt: '2026-02-02T20:11:00.000Z',
    verifiedPurchase: false,
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Inès F.',
    rating: 1,
    title: 'Reçue avec un éclat sur le corps',
    body: 'Emballage insuffisant, la caisse a voyagé sans calage. Retour accepté sans discuter, mais l’expérience reste mauvaise.',
    createdAt: '2025-07-28T12:00:00.000Z',
    verifiedPurchase: true,
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Paul B.',
    rating: 5,
    title: 'Parfaite pour la scène',
    body: 'Elle tient l’accord tout un set, y compris avec le vibrato. Rien à redire après six mois de concerts.',
    createdAt: '2025-12-01T07:44:00.000Z',
    verifiedPurchase: true,
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Awa S.',
    rating: 4,
    title: 'Belle finition, housse absente',
    body: 'L’instrument est irréprochable. J’aurais apprécié qu’une housse soit fournie à ce niveau de gamme.',
    createdAt: '2026-01-29T18:20:00.000Z',
    verifiedPurchase: false,
  },
  {
    productSlug: 'fender-player-ii-stratocaster-mn',
    author: 'Théo M.',
    rating: 3,
    title: 'Correcte, sans plus',
    body: 'Rien de choquant, rien d’enthousiasmant non plus. Le son manque un peu de caractère par rapport à une American.',
    createdAt: '2025-11-22T13:36:00.000Z',
    verifiedPurchase: false,
  },
];
