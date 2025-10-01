'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '../ui/switch';
import { useUser, useFirestore, useCollection, useMemoFirebase, FirestorePermissionError, errorEmitter } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, limit, getDocs, doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { Match } from '@/lib/types';
import { getInitialGameState, addSecondPlayer } from '@/lib/game-logic';
import { Loader2 } from 'lucide-react';

function generateJoinCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}


export function Lobby() {
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const publicMatchesQuery = useMemoFirebase(() => 
    firestore ? query(
        collection(firestore, 'matches'), 
        where('isPublic', '==', true),
        where('status', '==', 'LOBBY'),
        limit(10)
    ) : null,
  [firestore]);
  
  const { data: publicMatches, isLoading: isLoadingPublicMatches } = useCollection<Match>(publicMatchesQuery);

  const handleCreateGame = async () => {
    if (!user || !firestore) return;
    setIsLoading(true);
    setError(null);

    const player1 = { id: user.uid, name: user.displayName || `Jugador ${user.uid.substring(0,5)}`, hand: [], discardPile: [] };
    
    const initialGameState = getInitialGameState([player1]);

    const newMatch: Omit<Match, 'id'> = {
        player1Id: user.uid,
        player2Id: '',
        status: 'LOBBY',
        isPublic,
        joinCode: isPublic ? '' : generateJoinCode(),
        gameState: initialGameState,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    addDoc(collection(firestore, 'matches'), newMatch)
      .then((docRef) => {
        router.push(`/game/${docRef.id}`);
      })
      .catch((err) => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: 'matches',
            operation: 'create',
            requestResourceData: newMatch,
          })
        );
        setError('No se pudo crear la partida.');
        setIsLoading(false);
      });
  };

  const handleJoinWithCode = async () => {
    if (!user || !joinCode || !firestore) return;
    setIsLoading(true);
    setError(null);
    try {
        const q = query(collection(firestore, "matches"), where("joinCode", "==", joinCode), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            setError("No se encontró ninguna partida con ese código.");
            setIsLoading(false);
            return;
        }
        
        const matchDoc = querySnapshot.docs[0];
        const match = matchDoc.data() as Match;

        if (match.status !== 'LOBBY') {
             setError("Esta partida ya ha comenzado.");
             setIsLoading(false);
             return;
        }

        await handleJoinMatch(matchDoc.id, match);

    } catch (e) {
        console.error("Error joining game: ", e);
        setError("No se pudo unir a la partida.");
        setIsLoading(false);
    }
  };

  const handleJoinMatch = async (matchId: string, matchData: Match) => {
    if (!user || !firestore || matchData.player1Id === user.uid) return;
    setIsLoading(true);

    const player2 = { id: user.uid, name: user.displayName || `Jugador ${user.uid.substring(0,5)}`, hand: [], discardPile: [] };
    
    const newGameState = addSecondPlayer(matchData.gameState, player2);

    const matchRef = doc(firestore, 'matches', matchId);
    
    const updateData = {
        player2Id: user.uid,
        status: 'PLAYING' as const,
        gameState: newGameState,
        updatedAt: serverTimestamp(),
    };

    setDoc(matchRef, updateData, { merge: true })
      .then(() => {
        router.push(`/game/${matchId}`);
      })
      .catch((err) => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: `matches/${matchId}`,
            operation: 'update',
            requestResourceData: updateData,
          })
        );
        setError("No se pudo unir a la partida.");
        setIsLoading(false);
      });
  }


  return (
    <div className="max-w-2xl mx-auto">
      {error && <p className="text-destructive text-center mb-4">{error}</p>}
      <Tabs defaultValue="join">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="join" disabled={isLoading}>Unirse a Partida</TabsTrigger>
          <TabsTrigger value="create" disabled={isLoading}>Crear Partida</TabsTrigger>
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
                    {isLoading ? <Loader2 className="animate-spin" /> : "Unirse"}
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
                <CardTitle className='text-lg mb-2'>Partidas Públicas</CardTitle>
                <div className="border rounded-lg p-4 min-h-[10rem] space-y-2">
                    {isLoadingPublicMatches ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="animate-spin text-muted-foreground" />
                        </div>
                    ) : publicMatches && publicMatches.length > 0 ? (
                        publicMatches.map(match => (
                            <div key={match.id} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                                <span>Partida de {match.gameState?.players?.[0]?.name || 'un jugador'}</span>
                                <Button size="sm" onClick={() => handleJoinMatch(match.id!, match)} disabled={isLoading || match.player1Id === user?.uid}>
                                    {isLoading ? <Loader2 className="animate-spin" /> : "Unirse"}
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
                  <p className="text-sm font-medium leading-none">
                    Partida Pública
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tu partida será visible para todos en el lobby.
                  </p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={isLoading} />
              </div>
               <Button onClick={handleCreateGame} className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : "Crear Partida"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
