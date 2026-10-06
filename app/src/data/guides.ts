import type { CategorySlug } from '@/lib/types';

/**
 * Buying guides.
 *
 * Static editorial content, held in code rather than in the database on
 * purpose: nothing edits it at runtime, it has no per-visitor state, and giving
 * it a table would mean seeding it, migrating it and backing it up for no gain.
 * The catalogue is generated; these are the only words in the shop somebody
 * actually wrote.
 *
 * Each guide names the category it belongs to, which is what lets a shelf link
 * to its guide without a second table mapping the two.
 */

export interface GuideSection {
  heading: string;
  body: string;
}

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  category: CategorySlug;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: 'choisir-sa-premiere-guitare-electrique',
    title: 'Choisir sa première guitare électrique',
    summary:
      'Ce qui compte réellement sur un premier instrument, et ce qui peut attendre le deuxième.',
    category: 'guitares-electriques',
    sections: [
      {
        heading: 'Le manche avant tout',
        body: 'Un manche qui ne convient pas à votre main décourage plus sûrement que n’importe quel défaut de son. Profil en C, épaisseur moyenne et radius de 241 mm conviennent à la grande majorité des morphologies : c’est le point de départ raisonnable, et rien n’empêche d’explorer ensuite les manches fins ou les radius plats.',
      },
      {
        heading: 'Micros simples ou doubles',
        body: 'Les micros simples donnent un son clair et défini, avec un souffle caractéristique ; les doubles poussent l’ampli plus fort et conviennent aux styles saturés. Une configuration mixte évite d’avoir à trancher avant de savoir ce qu’on jouera vraiment.',
      },
      {
        heading: 'Le budget se répartit',
        body: 'Un instrument à 300 € bien réglé sonne mieux qu’un instrument à 600 € qui ne l’est pas. Prévoyez le réglage, un jeu de cordes neuf, un accordeur et un câble : ces quatre postes changent davantage l’expérience des premiers mois que cent euros de plus sur la guitare.',
      },
      {
        heading: 'L’ampli n’est pas un détail',
        body: 'Le son que vous entendez vient autant de l’ampli que de l’instrument. Un petit ampli à modélisation de 15 à 30 W suffit largement à la maison et permet d’essayer plusieurs univers sonores sans multiplier les achats.',
      },
    ],
  },
  {
    slug: 'bien-choisir-ses-cordes',
    title: 'Bien choisir ses cordes',
    summary: 'Tirant, alliage et fréquence de changement : trois décisions, trois effets distincts.',
    category: 'cordes',
    sections: [
      {
        heading: 'Le tirant décide du confort',
        body: 'Un tirant 9-42 se plie sans effort et convient aux solos et aux petites mains ; un 10-46 tient mieux l’accordage et sonne plus plein ; au-delà, on entre dans le territoire des accordages abaissés. Changer de tirant modifie la tension : un réglage du manche et de la justesse suit souvent.',
      },
      {
        heading: 'L’alliage décide du timbre',
        body: 'Sur électrique, le nickel plaqué est la référence polyvalente, l’acier pur est plus mordant. Sur acoustique, le bronze phosphoreux garde son éclat plus longtemps que le bronze 80/20, qui sonne plus brillant au premier jour.',
      },
      {
        heading: 'Changer plus souvent qu’on ne croit',
        body: 'Des cordes fatiguées perdent leur justesse avant de perdre leur son, et c’est ce qui pousse à croire que l’instrument est en cause. À raison d’une heure de jeu par jour, comptez un changement par mois ; la transpiration et l’acidité de la peau font varier ce chiffre du simple au double.',
      },
    ],
  },
  {
    slug: 'choisir-son-ampli-basse',
    title: 'Choisir son ampli basse',
    summary: 'Pourquoi la puissance annoncée ne dit presque rien, et ce qu’il faut regarder à la place.',
    category: 'amplis-basse',
    sections: [
      {
        heading: 'Les watts ne s’additionnent pas comme on l’imagine',
        body: 'Doubler la puissance ne double pas le volume perçu : il faut environ dix fois plus de watts pour doubler le volume ressenti. Un 300 W ne joue pas « trois fois plus fort » qu’un 100 W — il garde surtout sa dynamique quand on le pousse.',
      },
      {
        heading: 'Le haut-parleur fait le volume',
        body: 'La surface de membrane déplace l’air, et c’est l’air qui fait le volume. Un 15 pouces descend plus bas et pardonne davantage, deux 10 pouces projettent mieux sur scène. Le rendement du baffle pèse plus lourd que la puissance de l’étage de sortie.',
      },
      {
        heading: 'Répétition, scène, chambre',
        body: 'À la maison, 30 W suffisent et un casque suffit encore mieux. En répétition avec batterie, comptez 200 W au minimum. En concert, la sonorisation reprend la basse : l’ampli sert alors de retour et de couleur, plus de source de volume.',
      },
    ],
  },
];

export const GUIDE_BY_SLUG = new Map(GUIDES.map((guide) => [guide.slug, guide]));

/** Guides written for a shelf, so a category page can link to its own. */
export function guidesForCategory(category: CategorySlug): Guide[] {
  return GUIDES.filter((guide) => guide.category === category);
}
