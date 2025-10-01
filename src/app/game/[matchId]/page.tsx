// src/app/game/[matchId]/page.tsx
'use client';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GameBoard } from '@/components/game/GameBoard';
import { useParams } from 'next/navigation';

export default function GamePage() {
  const params = useParams();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;

  return (
    <AuthGuard>
      <div className="min-h-screen w-full bg-background font-body text-foreground p-2 md:p-4">
        <header className="py-4 px-6 border-b mb-4">
          <h1 className="text-2xl font-bold font-headline text-primary">Arcoíris Táctico Online</h1>
          <p className="text-muted-foreground">¡Que gane el mejor estratega!</p>
        </header>
        <main>
          {matchId ? <GameBoard matchId={matchId} /> : <p>Cargando partida...</p>}
        </main>
      </div>
    </AuthGuard>
  );
}
