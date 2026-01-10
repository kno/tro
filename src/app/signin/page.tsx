import Link from 'next/link';
import { SignInCard } from '@/components/auth/sign-in-card';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex max-w-lg flex-col gap-8 px-6 py-16">
        <Link href="/" className="text-sm text-slate-400">
          ← Volver al inicio
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">Accede a tu cuenta</h1>
          <p className="mt-2 text-sm text-slate-400">
            Usa Google o email para activar tu panel de descargas.
          </p>
        </div>
        <SignInCard />
      </div>
    </div>
  );
}
