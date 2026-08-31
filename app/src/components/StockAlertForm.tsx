'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * "Tell me when it is back."
 *
 * Only rendered on an unavailable product, and only for a signed-in customer —
 * the API refuses both cases, and a control that can only fail is worse than the
 * link that fixes it. The server decides which of the two to render, so the
 * right one is in the served HTML rather than appearing after hydration.
 */
export function StockAlertForm({
  slug,
  subscribed,
  canSubscribe,
}: {
  slug: string;
  subscribed: boolean;
  canSubscribe: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  });

  if (!canSubscribe) {
    return (
      <p className="mt-4 text-sm text-fg-muted" data-testid="alert-signin-hint">
        <a href="/compte/connexion" className="underline hover:text-amber-brand">
          Connectez-vous
        </a>{' '}
        pour être prévenu du retour en stock.
      </p>
    );
  }

  async function toggle() {
    setPending(true);
    setStatus({ kind: 'idle', message: '' });

    try {
      const response = await fetch(`/api/products/${slug}/alerts`, {
        method: subscribed ? 'DELETE' : 'POST',
      });

      if (!response.ok) {
        const payload = await response.json();
        setStatus({ kind: 'error', message: payload?.error?.message ?? 'Opération impossible.' });
        return;
      }

      setStatus({
        kind: 'success',
        message: subscribed
          ? 'Alerte retirée.'
          : 'Nous vous préviendrons dès le retour en stock.',
      });
      // The button's label depends on server state, so the page is re-rendered
      // rather than the label flipped locally.
      router.refresh();
    } catch {
      setStatus({ kind: 'error', message: 'Une erreur réseau est survenue. Réessayez.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={subscribed}
        data-testid="stock-alert-toggle"
        data-subscribed={subscribed ? 'true' : 'false'}
        className="w-full rounded-md border border-line-strong px-4 py-2 text-sm font-semibold hover:border-amber-brand disabled:cursor-not-allowed disabled:text-fg-muted"
      >
        {subscribed ? 'Ne plus être prévenu' : 'Prévenez-moi du retour en stock'}
      </button>

      <p
        role="status"
        aria-live="polite"
        data-testid="stock-alert-status"
        data-status={status.kind}
        className={
          status.kind === 'error'
            ? 'mt-2 text-xs font-semibold text-danger'
            : 'mt-2 text-xs font-semibold text-success'
        }
      >
        {status.message}
      </p>
    </div>
  );
}
