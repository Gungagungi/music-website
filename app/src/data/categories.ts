import type { Category } from '@/lib/types';

export const CATEGORIES: Category[] = [
  {
    slug: 'guitares-electriques',
    label: 'Guitares électriques',
    group: 'Guitares',
    tagline: 'Solid body, semi-hollow et signatures, du modèle d’étude à la lutherie haut de gamme.',
  },
  {
    slug: 'guitares-acoustiques',
    label: 'Guitares acoustiques',
    group: 'Guitares',
    tagline: 'Dreadnought, grand auditorium et parlor, avec ou sans électronique embarquée.',
  },
  {
    slug: 'guitares-classiques',
    label: 'Guitares classiques',
    group: 'Guitares',
    tagline: 'Cordes nylon en 4/4, 3/4 et 7/8, pour l’étude comme pour la scène.',
  },
  {
    slug: 'basses-electriques',
    label: 'Basses électriques',
    group: 'Basses',
    tagline: 'Precision, Jazz, moderne 5 cordes : le socle rythmique de tous les styles.',
  },
  {
    slug: 'amplis-guitare',
    label: 'Amplis guitare',
    group: 'Amplification',
    tagline: 'Lampes, transistor et modélisation, du combo de salon au head de scène.',
  },
  {
    slug: 'amplis-basse',
    label: 'Amplis basse',
    group: 'Amplification',
    tagline: 'Combos et têtes pensés pour la définition dans le bas du spectre.',
  },
  {
    slug: 'pedales-effets',
    label: 'Pédales d’effets',
    group: 'Amplification',
    tagline: 'Overdrive, fuzz, modulation, réverbe et multi-effets pour bâtir son pedalboard.',
  },
  {
    slug: 'cordes',
    label: 'Cordes',
    group: 'Accessoires',
    tagline: 'Jeux électriques, acoustiques, classiques et basse, à l’unité ou en pack.',
  },
  {
    slug: 'accessoires',
    label: 'Accessoires',
    group: 'Accessoires',
    tagline: 'Étuis, stands, médiators, câbles, sangles et systèmes sans fil.',
  },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((category) => [category.slug, category]));

export const CATEGORY_GROUPS = ['Guitares', 'Basses', 'Amplification', 'Accessoires'] as const;
