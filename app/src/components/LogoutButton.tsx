'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
        router.refresh();
      }}
      className="rounded border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-amber-brand"
      data-testid="logout-button"
    >
      {pending ? 'Déconnexion…' : 'Se déconnecter'}
    </button>
  );
}
