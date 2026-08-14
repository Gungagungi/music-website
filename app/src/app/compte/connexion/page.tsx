import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/AuthForm';
import { Breadcrumb } from '@/components/Breadcrumb';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const user = await currentUser();
  const { redirect: target } = await searchParams;
  if (user) redirect(target ?? '/compte/commandes');

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Breadcrumb trail={[{ label: 'Accueil', href: '/' }, { label: 'Connexion' }]} />
      <h1 className="mt-4 text-3xl font-bold" data-testid="login-title">
        Se connecter
      </h1>

      <div className="mt-6 rounded-lg border border-ink-100 bg-white p-6">
        <AuthForm mode="login" redirectTo={target ?? '/compte/commandes'} />
      </div>

      <p className="mt-6 text-sm text-ink-500">
        Pas encore de compte ?{' '}
        <Link href="/compte/inscription" className="underline hover:text-amber-brand" data-testid="register-link">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
