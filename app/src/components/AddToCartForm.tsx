'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { enUnitesMonetaires, push } from '@/lib/analytics';
import { MAX_QUANTITY_PER_LINE } from '@/lib/cart-constants';
import type { Product } from '@/lib/types';

export function AddToCartForm({ product }: { product: Product }) {
  const router = useRouter();
  const [color, setColor] = useState(product.colors[0] ?? '');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  });
  const [pending, setPending] = useState(false);

  const outOfStock = product.stock <= 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus({ kind: 'idle', message: '' });

    try {
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity, color: color || null }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus({ kind: 'error', message: payload?.error?.message ?? 'Ajout impossible.' });
        return;
      }

      setStatus({
        kind: 'success',
        message: `« ${product.name} » a été ajouté à votre panier.`,
      });

      // Matomo veut l'état du panier après l'ajout, pas le delta : la réponse
      // porte le panier complet, donc on rejoue ses lignes plutôt que de tenir
      // un compte parallèle qui divergerait au premier ajout depuis un autre
      // onglet. Inerte sans tracker (lib/analytics.ts).
      for (const item of payload.items ?? []) {
        push([
          'addEcommerceItem',
          item.sku,
          `${item.brand} ${item.name}`,
          '',
          enUnitesMonetaires(item.unitPrice),
          item.quantity,
        ]);
      }
      push(['trackEcommerceCartUpdate', enUnitesMonetaires(payload.totals?.total ?? 0)]);

      // The header cart badge is server-rendered, so the layout has to be
      // re-fetched for the count to catch up.
      router.refresh();
    } catch {
      setStatus({ kind: 'error', message: 'Une erreur réseau est survenue. Réessayez.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} data-testid="add-to-cart-form" className="space-y-4">
      {product.colors.length > 1 && (
        <div>
          <label htmlFor="product-color" className="block text-sm font-semibold">
            Coloris
          </label>
          <select
            id="product-color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            data-testid="product-color"
          >
            {product.colors.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="product-quantity" className="block text-sm font-semibold">
          Quantité
        </label>
        <input
          id="product-quantity"
          type="number"
          min={1}
          max={Math.min(MAX_QUANTITY_PER_LINE, Math.max(product.stock, 1))}
          value={quantity}
          onChange={(event) => setQuantity(Number.parseInt(event.target.value, 10) || 1)}
          className="mt-1 w-24 rounded border border-line px-3 py-2"
          data-testid="product-quantity"
          disabled={outOfStock}
        />
      </div>

      <button
        type="submit"
        disabled={outOfStock || pending}
        className="w-full rounded-md bg-amber-brand px-5 py-3 font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white disabled:cursor-not-allowed disabled:bg-disabled disabled:text-fg-muted"
        data-testid="add-to-cart"
      >
        {outOfStock ? 'Produit indisponible' : pending ? 'Ajout en cours…' : 'Ajouter au panier'}
      </button>

      {/* role="status" so the confirmation is announced to screen readers and is
          reliably awaitable from a test without an arbitrary timeout. */}
      <p
        role="status"
        aria-live="polite"
        data-testid="add-to-cart-status"
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
