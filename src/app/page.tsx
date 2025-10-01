// This component is rendered on the client-side
'use client';

import { GameBoard } from '@/components/game/GameBoard';

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-background font-body text-foreground">
      <header className="py-4 px-6 border-b">
        <h1 className="text-2xl font-bold font-headline text-primary">Arcoíris Táctico Online</h1>
        <p className="text-muted-foreground">Gana más cartas que tu rival completando ARCOÍRIS mientras gestionas información oculta, memoria y faroleo.</p>
      </header>
      <main className="p-2 md:p-4">
        <GameBoard />
      </main>
    </div>
  );
}
