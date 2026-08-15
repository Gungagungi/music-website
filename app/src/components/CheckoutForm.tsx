'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { formatPrice } from '@/lib/money';
import type { Cart } from '@/lib/types';

/**
 * One deliberately seeded defect, gated behind SEED_BUGS=1 (build-time, since
 * this is a client component). See docs/bug-reports/BUG-003-missing-form-labels.md
 * — the "complément d'adresse" field loses its label association.
 */
const MISSING_LABEL_BUG_ENABLED = process.env.NEXT_PUBLIC_SEED_BUGS === '1';

type Step = 'livraison' | 'paiement' | 'recapitulatif';

const STEPS: { key: Step; label: string }[] = [
  { key: 'livraison', label: 'Livraison' },
  { key: 'paiement', label: 'Paiement' },
  { key: 'recapitulatif', label: 'Récapitulatif' },
];

interface AddressState {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
}

const EMPTY_ADDRESS: AddressState = {
  firstName: '',
  lastName: '',
  line1: '',
  line2: '',
  postalCode: '',
  city: '',
  country: 'France',
  phone: '',
};

export function CheckoutForm({ cart, isAuthenticated }: { cart: Cart; isAuthenticated: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('livraison');
  const [address, setAddress] = useState<AddressState>(EMPTY_ADDRESS);
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'carte' | 'virement' | 'paypal'>('carte');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  function validateShipping(): boolean {
    const next: Record<string, string> = {};
    if (!isAuthenticated && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim())) {
      next.email = 'Adresse e-mail invalide.';
    }
    if (!address.firstName.trim()) next.firstName = 'Le prénom est obligatoire.';
    if (!address.lastName.trim()) next.lastName = 'Le nom est obligatoire.';
    if (!address.line1.trim()) next.line1 = 'L’adresse est obligatoire.';
    if (!/^\d{5}$/.test(address.postalCode.trim())) {
      next.postalCode = 'Le code postal doit comporter 5 chiffres.';
    }
    if (!address.city.trim()) next.city = 'La ville est obligatoire.';
    if (address.phone.trim() && !/^(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}$/.test(address.phone.trim())) {
      next.phone = 'Numéro de téléphone invalide.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function placeOrder() {
    if (!acceptTerms) {
      setErrors({ acceptTerms: 'Vous devez accepter les conditions générales de vente.' });
      return;
    }

    setPending(true);
    setFormError('');

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(isAuthenticated ? {} : { email: email.trim() }),
          shippingAddress: {
            firstName: address.firstName.trim(),
            lastName: address.lastName.trim(),
            line1: address.line1.trim(),
            line2: address.line2.trim() || null,
            postalCode: address.postalCode.trim(),
            city: address.city.trim(),
            country: address.country.trim(),
            phone: address.phone.trim() || null,
          },
          paymentMethod,
          acceptTerms: true,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setFormError(body?.error?.message ?? 'La commande n’a pas pu être enregistrée.');
        return;
      }

      router.push(`/commande/confirmation/${body.reference}?token=${body.accessToken}`);
      router.refresh();
    } catch {
      setFormError('Une erreur réseau est survenue. Réessayez.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <ol className="flex flex-wrap gap-2" data-testid="checkout-steps">
          {STEPS.map((entry, index) => (
            <li
              key={entry.key}
              data-testid={`checkout-step-${entry.key}`}
              aria-current={step === entry.key ? 'step' : undefined}
              className={
                step === entry.key
                  ? 'rounded bg-ink-900 px-3 py-2 text-sm font-semibold text-white'
                  : 'rounded border border-ink-100 bg-white px-3 py-2 text-sm text-ink-500'
              }
            >
              {index + 1}. {entry.label}
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-lg border border-ink-100 bg-white p-6">
          {step === 'livraison' && (
            <form
              data-testid="shipping-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (validateShipping()) setStep('paiement');
              }}
              className="space-y-4"
            >
              <h2 className="text-xl font-bold">Adresse de livraison</h2>

              {!isAuthenticated && (
                <TextField
                  id="email"
                  label="Adresse e-mail"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  error={errors.email}
                  hint="Elle nous sert à vous envoyer la confirmation de commande."
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="firstName"
                  label="Prénom"
                  value={address.firstName}
                  onChange={(value) => setAddress({ ...address, firstName: value })}
                  error={errors.firstName}
                />
                <TextField
                  id="lastName"
                  label="Nom"
                  value={address.lastName}
                  onChange={(value) => setAddress({ ...address, lastName: value })}
                  error={errors.lastName}
                />
              </div>

              <TextField
                id="line1"
                label="Adresse"
                value={address.line1}
                onChange={(value) => setAddress({ ...address, line1: value })}
                error={errors.line1}
              />

              {MISSING_LABEL_BUG_ENABLED ? (
                <input
                  type="text"
                  value={address.line2}
                  onChange={(event) => setAddress({ ...address, line2: event.target.value })}
                  className="w-full rounded border border-ink-100 px-3 py-2"
                  data-testid="field-line2"
                />
              ) : (
                <TextField
                  id="line2"
                  label="Complément d’adresse (facultatif)"
                  value={address.line2}
                  onChange={(value) => setAddress({ ...address, line2: value })}
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="postalCode"
                  label="Code postal"
                  value={address.postalCode}
                  onChange={(value) => setAddress({ ...address, postalCode: value })}
                  error={errors.postalCode}
                  inputMode="numeric"
                />
                <TextField
                  id="city"
                  label="Ville"
                  value={address.city}
                  onChange={(value) => setAddress({ ...address, city: value })}
                  error={errors.city}
                />
              </div>

              <TextField
                id="phone"
                label="Téléphone (facultatif)"
                value={address.phone}
                onChange={(value) => setAddress({ ...address, phone: value })}
                error={errors.phone}
                inputMode="tel"
              />

              <button
                type="submit"
                className="rounded-md bg-amber-brand px-5 py-3 font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white"
                data-testid="shipping-continue"
              >
                Continuer vers le paiement
              </button>
            </form>
          )}

          {step === 'paiement' && (
            <form
              data-testid="payment-form"
              onSubmit={(event) => {
                event.preventDefault();
                setStep('recapitulatif');
              }}
              className="space-y-4"
            >
              <h2 className="text-xl font-bold">Moyen de paiement</h2>

              <fieldset className="space-y-2">
                <legend className="sr-only">Choisissez un moyen de paiement</legend>
                {(
                  [
                    ['carte', 'Carte bancaire'],
                    ['virement', 'Virement bancaire'],
                    ['paypal', 'PayPal'],
                  ] as const
                ).map(([value, label]) => (
                  <div key={value} className="flex items-center gap-2">
                    <input
                      id={`payment-${value}`}
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={paymentMethod === value}
                      onChange={() => setPaymentMethod(value)}
                      className="size-4"
                      data-testid={`payment-${value}`}
                    />
                    <label htmlFor={`payment-${value}`}>{label}</label>
                  </div>
                ))}
              </fieldset>

              <p className="rounded bg-ink-50 p-3 text-sm text-ink-500">
                Aucun paiement réel n’est effectué : ce site est une démonstration.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('livraison')}
                  className="rounded border border-ink-100 px-5 py-3 font-semibold"
                  data-testid="payment-back"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-amber-brand px-5 py-3 font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white"
                  data-testid="payment-continue"
                >
                  Vérifier ma commande
                </button>
              </div>
            </form>
          )}

          {step === 'recapitulatif' && (
            <div data-testid="review-step" className="space-y-4">
              <h2 className="text-xl font-bold">Vérifiez votre commande</h2>

              <div className="rounded border border-ink-100 p-4 text-sm" data-testid="review-address">
                <p className="font-semibold">Livraison</p>
                <p>
                  {address.firstName} {address.lastName}
                </p>
                <p>{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p>
                  {address.postalCode} {address.city}
                </p>
                <p>{address.country}</p>
              </div>

              <div className="rounded border border-ink-100 p-4 text-sm" data-testid="review-payment">
                <p className="font-semibold">Paiement</p>
                <p>
                  {paymentMethod === 'carte'
                    ? 'Carte bancaire'
                    : paymentMethod === 'virement'
                      ? 'Virement bancaire'
                      : 'PayPal'}
                </p>
              </div>

              <div className="flex items-start gap-2">
                <input
                  id="accept-terms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(event) => {
                    setAcceptTerms(event.target.checked);
                    if (event.target.checked) setErrors({});
                  }}
                  className="mt-1 size-4"
                  aria-invalid={errors.acceptTerms ? true : undefined}
                  aria-describedby={errors.acceptTerms ? 'accept-terms-error' : undefined}
                  data-testid="accept-terms"
                />
                <label htmlFor="accept-terms" className="text-sm">
                  J’accepte les conditions générales de vente.
                </label>
              </div>
              {errors.acceptTerms && (
                <p id="accept-terms-error" className="text-sm text-red-700" data-testid="error-acceptTerms">
                  {errors.acceptTerms}
                </p>
              )}

              <p role="alert" data-testid="checkout-error" className="text-sm font-semibold text-red-700">
                {formError}
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('paiement')}
                  className="rounded border border-ink-100 px-5 py-3 font-semibold"
                  data-testid="review-back"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={() => void placeOrder()}
                  disabled={pending}
                  className="rounded-md bg-amber-brand px-5 py-3 font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white disabled:bg-ink-300"
                  data-testid="place-order"
                >
                  {pending ? 'Envoi en cours…' : 'Valider et payer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-lg border border-ink-100 bg-white p-6" data-testid="checkout-summary">
        <h2 className="text-lg font-bold">Votre commande</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {cart.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3" data-testid="checkout-line">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span className="font-semibold">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Sous-total</dt>
            <dd data-testid="summary-subtotal">{formatPrice(cart.totals.subtotal)}</dd>
          </div>
          {cart.totals.discount > 0 && (
            <div className="flex justify-between">
              <dt>Remise</dt>
              <dd data-testid="summary-discount">- {formatPrice(cart.totals.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Livraison</dt>
            <dd data-testid="summary-shipping">
              {cart.totals.shipping === 0 ? 'Offerte' : formatPrice(cart.totals.shipping)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-ink-100 pt-3 text-lg font-bold">
            <dt>Total</dt>
            <dd data-testid="summary-total">{formatPrice(cart.totals.total)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  inputMode?: 'numeric' | 'tel';
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="mt-1 w-full rounded border border-ink-100 px-3 py-2"
        data-testid={`field-${id}`}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700" data-testid={`error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}
