import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/AuthForm';
import { Breadcrumb } from '@/components/Breadcrumb';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Créer un compte' };

export default async function RegisterPage() {
  if (await currentUser()) redirect('/compte/commandes');

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Créer un compte' }]} />
      <h1 className="mt-4 text-3xl font-bold" data-testid="register-title">
        Créer un compte
      </h1>

      <div className="mt-6 rounded-lg border border-ink-100 bg-white p-6">
        <AuthForm mode="register" redirectTo="/compte/commandes" />
      </div>

      <p className="mt-6 text-sm text-ink-500">
        Vous avez déjà un compte ?{' '}
        <Link href="/compte/connexion" className="underline hover:text-amber-brand">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
