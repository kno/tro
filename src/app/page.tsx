// This component is rendered on the client-side
'use client';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Lobby } from '@/components/lobby/Lobby';


export default function Home() {
  return (
    <AuthGuard>
      <div className="min-h-screen w-full bg-background font-body text-foreground">
        <header className="py-4 px-6 border-b">
          <h1 className="text-2xl font-bold font-headline text-primary">Arcoíris Táctico Online</h1>
          <p className="text-muted-foreground">Crea una partida o únete a una existente.</p>
        </header>
        <main className="p-2 md:p-4">
          <Lobby />
        </main>
      </div>
    </AuthGuard>
  );
}
