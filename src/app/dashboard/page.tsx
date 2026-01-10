import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { TelegramPanel } from '@/components/telegram/telegram-panel';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Panel de descargas
            </p>
            <h1 className="text-3xl font-semibold">Hola, {session.user?.name ?? 'Usuario'}</h1>
            <p className="text-sm text-slate-400">
              Gestiona tu sesión de Telegram y descarga archivos desde tus canales.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm"
            >
              Inicio
            </Link>
            <Link
              href="/api/auth/signout"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Cerrar sesión
            </Link>
          </div>
        </header>
        <main className="mt-8 grid gap-8 lg:grid-cols-[2fr,1fr]">
          <TelegramPanel />
          <aside className="rounded-2xl border border-slate-800 p-6">
            <h2 className="text-lg font-semibold">Buenas prácticas</h2>
            <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-slate-400">
              <li>Usa canales con permisos claros para descargar archivos.</li>
              <li>Mantén actualizados los credenciales de Telegram en tu perfil.</li>
              <li>Comprueba el tamaño y formato antes de iniciar la descarga.</li>
            </ul>
          </aside>
        </main>
      </div>
    </div>
  );
}
