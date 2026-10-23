import { describe, expect, it } from 'vitest';

import { publicOrigin } from '@/lib/site-origin';

/**
 * The origin ends up in the sitemap and in robots.txt, where a wrong scheme or
 * host sends every crawler to URLs that redirect or do not exist — a defect no
 * page of the shop would show.
 */
describe('publicOrigin', () => {
  it('reprend l’hôte d’une requête servie sans proxy, en HTTP', () => {
    expect(publicOrigin(new Headers({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
  });

  it('retient le schéma vu par le navigateur derrière Caddy', () => {
    const headers = new Headers({ host: 'fretline.example', 'x-forwarded-proto': 'https' });

    expect(publicOrigin(headers)).toBe('https://fretline.example');
  });

  it('préfère x-forwarded-host à l’hôte du dernier saut', () => {
    const headers = new Headers({
      host: 'prod-app:3000',
      'x-forwarded-host': 'fretline.example',
      'x-forwarded-proto': 'https',
    });

    expect(publicOrigin(headers)).toBe('https://fretline.example');
  });

  it('retient la première valeur quand plusieurs proxies se sont succédé', () => {
    const headers = new Headers({
      host: 'prod-app:3000',
      'x-forwarded-host': 'fretline.example, edge.internal',
      'x-forwarded-proto': 'https, http',
    });

    expect(publicOrigin(headers)).toBe('https://fretline.example');
  });

  it('ramène un schéma inconnu à HTTP plutôt que de le recopier', () => {
    const headers = new Headers({ host: 'fretline.example', 'x-forwarded-proto': 'javascript' });

    expect(publicOrigin(headers)).toBe('http://fretline.example');
  });

  it('normalise l’hôte et retire le port par défaut', () => {
    const headers = new Headers({ host: 'Fretline.Example:443', 'x-forwarded-proto': 'https' });

    expect(publicOrigin(headers)).toBe('https://fretline.example');
  });

  it('refuse un hôte malformé au lieu de l’écrire dans le document', () => {
    expect(() => publicOrigin(new Headers({ host: 'exa mple' }))).toThrow();
  });
});
