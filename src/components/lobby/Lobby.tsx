'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '../ui/switch';
import { useAuthentication, usePublicMatches, useMatchesActions } from '@/data';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function Lobby() {
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuthentication();
  const router = useRouter();
  const { data: publicMatches, isLoading: isLoadingPublicMatches } = usePublicMatches();
  const { createMatch, findMatchByJoinCode, joinMatch } = useMatchesActions();

  const handleCreateGame = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await createMatch({ playerId: user.uid, isPublic });
      router.push(`/game/${result.matchId}`);
    } catch (e) {
      console.error('Error creating match', e);
      setError('No se pudo crear la partida.');
      setIsLoading(false);
    }
  };

  const handleJoinMatch = async (matchId: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      await joinMatch(matchId, user.uid);
      router.push(`/game/${matchId}`);
    } catch (e) {
      console.error('Error joining match', e);
      setError('No se pudo unir a la partida. Asegúrate de no unirte a tu propia partida.');
      setIsLoading(false);
    }
  };

  const handleJoinWithCode = async () => {
    if (!user || !joinCode) return;

    setIsLoading(true);
    setError(null);

    try {
      const match = await findMatchByJoinCode(joinCode);

      if (!match || !match.id) {
        setError('No se encontró ninguna partida con ese código.');
        setIsLoading(false);
        return;
      }

      if (match.status !== 'LOBBY') {
        setError('Esta partida ya ha comenzado.');
        setIsLoading(false);
        return;
      }

      if (match.player1Id === user.uid) {
        setError('No puedes unirte a tu propia partida.');
        setIsLoading(false);
        return;
      }

      await handleJoinMatch(match.id);
    } catch (e) {
      console.error('Error joining game: ', e);
      setError('No se pudo unir a la partida.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {error && <p className="text-destructive text-center mb-4">{error}</p>}
      <Tabs defaultValue="join">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="join" disabled={isLoading}>
            Unirse a Partida
          </TabsTrigger>
          <TabsTrigger value="create" disabled={isLoading}>
            Crear Partida
          </TabsTrigger>
        </TabsList>
        <TabsContent value="join">
          <Card>
            <CardHeader>
              <CardTitle>Unirse a una Partida</CardTitle>
              <CardDescription>Busca una partida pública o introduce un código privado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-code">Código de Partida Privada</Label>
                <div className="flex gap-2">
                  <Input
                    id="join-code"
                    placeholder="Introduce el código"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    disabled={isLoading}
                  />
                  <Button onClick={handleJoinWithCode} disabled={!joinCode || isLoading}>
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Unirse'}
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">O</span>
                </div>
              </div>
              <div>
                <CardTitle className="text-lg mb-2">Partidas Públicas</CardTitle>
                <div className="border rounded-lg p-4 min-h-[10rem] space-y-2">
                  {isLoadingPublicMatches ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="animate-spin text-muted-foreground" />
                    </div>
                  ) : publicMatches && publicMatches.length > 0 ? (
                    publicMatches.map((match) => (
                      <div key={match.id} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                        <span>Partida de {'un jugador'}</span>
                        <Button
                          size="sm"
                          onClick={() => match.id && handleJoinMatch(match.id)}
                          disabled={isLoading || match.player1Id === user?.uid}
                        >
                          {isLoading ? <Loader2 className="animate-spin" /> : 'Unirse'}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-center items-center h-full text-center text-muted-foreground">
                      <p>No hay partidas públicas disponibles.</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Crear Nueva Partida</CardTitle>
              <CardDescription>Configura tu nueva partida y espera a un oponente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4 rounded-md border p-4">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">Partida Pública</p>
                  <p className="text-sm text-muted-foreground">Tu partida será visible para todos en el lobby.</p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={isLoading} />
              </div>
              <Button onClick={handleCreateGame} className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : 'Crear Partida'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
