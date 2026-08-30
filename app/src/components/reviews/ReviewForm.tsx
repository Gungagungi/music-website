'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Publishes a review from the product page.
 *
 * Rendered only for a signed-in customer — the API refuses an anonymous post
 * with 401, and offering a form that can only fail is worse than a link to the
 * sign-in page. The server decides which of the two to show, so the choice is
 * in the served HTML and does not depend on hydration.
 *
 * On success the form does not splice the new review into the list: it calls
 * `router.refresh()`, so the list, the histogram and the product's average all
 * come back from the server together. Anything else would show a review the
 * aggregates do not yet count.
 */
export function ReviewForm({ slug, canReview }: { slug: string; canReview: boolean }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  });

  if (!canReview) {
    return (
      <p className="mt-8 rounded-lg border border-dashed border-line-strong p-4 text-sm text-fg-muted" data-testid="review-signin-hint">
        <a href="/compte/connexion" className="underline hover:text-amber-brand">
          Connectez-vous
        </a>{' '}
        pour publier un avis sur ce produit.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus({ kind: 'idle', message: '' });

    try {
      const response = await fetch(`/api/products/${slug}/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating, title, body }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus({
          kind: 'error',
          message: payload?.error?.message ?? 'Publication impossible.',
        });
        return;
      }

      setStatus({ kind: 'success', message: 'Merci, votre avis a été publié.' });
      setTitle('');
      setBody('');
      setRating(5);
      router.refresh();
    } catch {
      setStatus({ kind: 'error', message: 'Une erreur réseau est survenue. Réessayez.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 space-y-4 rounded-lg border border-line bg-surface p-4"
      data-testid="review-form"
    >
      <h3 className="font-semibold">Donner votre avis</h3>

      <div>
        <label htmlFor="review-rating" className="block text-sm font-semibold">
          Note
        </label>
        <select
          id="review-rating"
          value={rating}
          onChange={(event) => setRating(Number.parseInt(event.target.value, 10))}
          className="mt-1 rounded border border-line bg-surface px-3 py-2"
          data-testid="review-rating"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} étoile{value > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="review-title" className="block text-sm font-semibold">
          Titre
        </label>
        <input
          id="review-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={100}
          className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
          data-testid="review-title"
        />
      </div>

      <div>
        <label htmlFor="review-body" className="block text-sm font-semibold">
          Commentaire
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={2000}
          className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
          data-testid="review-body"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-amber-brand px-5 py-2 font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white disabled:cursor-not-allowed disabled:bg-disabled disabled:text-fg-muted"
        data-testid="review-submit"
      >
        {pending ? 'Publication…' : 'Publier mon avis'}
      </button>

      {/* Same contract as the add-to-cart status: always present, carrying
          `data-status`, so a test waits on a state change and not on a delay. */}
      <p
        role="status"
        aria-live="polite"
        data-testid="review-status"
        data-status={status.kind}
        className={
          status.kind === 'error'
            ? 'text-sm font-semibold text-danger'
            : 'text-sm font-semibold text-success'
        }
      >
        {status.message}
      </p>
    </form>
  );
}
