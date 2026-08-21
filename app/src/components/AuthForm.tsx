'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface FieldErrors {
  [field: string]: string;
}

/**
 * Shared login / registration form.
 *
 * Field-level errors are rendered next to their input and wired through
 * `aria-describedby` + `aria-invalid`, so the same markup satisfies the
 * accessibility suite and gives the UI suite a stable place to assert on
 * validation messages.
 */
export function AuthForm({ mode, redirectTo }: { mode: 'login' | 'register'; redirectTo: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError('');
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const payload =
      mode === 'login'
        ? {
            email: String(formData.get('email') ?? ''),
            password: String(formData.get('password') ?? ''),
          }
        : {
            email: String(formData.get('email') ?? ''),
            password: String(formData.get('password') ?? ''),
            firstName: String(formData.get('firstName') ?? ''),
            lastName: String(formData.get('lastName') ?? ''),
          };

    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        const details: { field: string; message: string }[] = body?.error?.details ?? [];
        if (details.length > 0) {
          setFieldErrors(Object.fromEntries(details.map((detail) => [detail.field, detail.message])));
        }
        setFormError(body?.error?.message ?? 'Une erreur est survenue.');
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setFormError('Une erreur réseau est survenue. Réessayez.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} data-testid="auth-form" noValidate className="space-y-4">
      {mode === 'register' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="firstName"
            label="Prénom"
            autoComplete="given-name"
            error={fieldErrors.firstName}
          />
          <Field id="lastName" label="Nom" autoComplete="family-name" error={fieldErrors.lastName} />
        </div>
      )}

      <Field
        id="email"
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <Field
        id="password"
        label="Mot de passe"
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        error={fieldErrors.password}
        hint={mode === 'register' ? '8 caractères minimum, dont au moins un chiffre.' : undefined}
      />

      <p role="alert" data-testid="auth-error" className="text-sm font-semibold text-danger">
        {formError}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-amber-brand px-5 py-3 font-semibold text-ink-950 hover:bg-amber-brandDark hover:text-white disabled:bg-disabled"
        data-testid="auth-submit"
      >
        {pending ? 'Veuillez patienter…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type = 'text',
  autoComplete,
  error,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
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
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="mt-1 w-full rounded border border-line px-3 py-2"
        data-testid={`field-${id}`}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger" data-testid={`error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}
