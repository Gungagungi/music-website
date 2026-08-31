'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Saves a product, or removes it — the same control, like the comparison
 * toggle. `saved` comes from the server, so the label is right on first paint.
 *
 * A signed-out visitor gets a link to sign in rather than a heart that answers
 * 401. Unlike the comparison selection, this one cannot fall back to a cookie:
 * the list is worth having *because* it outlives the browser it was made in.
 */
export function WishlistToggle({
  slug,
  saved,
  canSave,
  variant = 'link',
}: {
  slug: string;
  saved: boolean;
  canSave: boolean;
  variant?: 'link' | 'button';
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!canSave) {
    return (
      <a
        href="/compte/connexion?redirect=/compte/favoris"
        data-testid="wishlist-signin-hint"
        className={
          variant === 'button'
            ? 'block w-full rounded-md border border-line-strong px-4 py-2 text-center text-sm font-semibold hover:border-amber-brand'
            : 'text-left text-xs underline text-fg-muted hover:text-amber-brand'
        }
      >
        Connectez-vous pour enregistrer
      </a>
    );
  }

  async function toggle() {
    setPending(true);
    try {
      await fetch(`/api/products/${slug}/wishlist`, { method: saved ? 'DELETE' : 'POST' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      data-testid="wishlist-toggle"
      data-saved={saved ? 'true' : 'false'}
      data-slug={slug}
      className={
        variant === 'button'
          ? 'w-full rounded-md border border-line-strong px-4 py-2 text-sm font-semibold hover:border-amber-brand disabled:text-fg-muted'
          : 'text-left text-xs underline text-fg-muted hover:text-amber-brand disabled:text-disabled'
      }
    >
      {/* The heart is decorative: the label already says what the control does,
          and a screen reader announcing "emoji black heart" adds nothing. */}
      <span aria-hidden="true">{saved ? '♥' : '♡'}</span>{' '}
      {saved ? 'Retirer des favoris' : 'Enregistrer en favori'}
    </button>
  );
}
