'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export function SignInCard() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleEmailSignIn = async () => {
    if (!email) return;
    setStatus('sending');
    await signIn('email', { email, callbackUrl: '/dashboard' });
    setStatus('sent');
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-900"
        >
          Continuar con Google
        </button>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-800" />
          o
          <span className="h-px flex-1 bg-slate-800" />
        </div>
        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@email.com"
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
        />
        <button
          type="button"
          onClick={handleEmailSignIn}
          disabled={!email || status === 'sending'}
          className="rounded-full border border-slate-700 px-4 py-3 text-sm font-semibold"
        >
          {status === 'sent' ? 'Revisa tu bandeja de entrada' : 'Enviar enlace mágico'}
        </button>
      </div>
    </div>
  );
}
