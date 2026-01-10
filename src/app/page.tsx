import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <header className="flex flex-col gap-6">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            TeleDescargas
          </p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Descarga archivos de Telegram con acceso seguro y multiusuario.
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Autentica con Google o email, conecta tu cuenta de Telegram y accede a un
            panel optimizado para encontrar canales y descargar los archivos que necesitas.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/signin"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950"
            >
              Empezar ahora
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold"
            >
              Ir al panel
            </Link>
          </div>
        </header>
        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Autenticación empresarial',
              description:
                'Registro con email y acceso social con Google gestionado por NextAuth y MySQL.',
            },
            {
              title: 'Conexión directa a Telegram',
              description:
                'Inicia sesión con tu cuenta, navega canales y gestiona sesiones cifradas por usuario.',
            },
            {
              title: 'Descargas en primer plano',
              description:
                'Flujo dedicado para localizar medios y descargar archivos con un clic.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-800 p-6">
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{item.description}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
