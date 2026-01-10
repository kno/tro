import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/auth/session-provider';

export const metadata: Metadata = {
  title: 'TeleDescargas',
  description:
    'Plataforma multiusuario para autenticar con Google o email y descargar archivos desde Telegram.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
