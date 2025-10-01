'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '../ui/switch';

export function Lobby() {
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState('');

  const handleCreateGame = () => {
    // TODO: Implement game creation logic
    console.log(`Creating a ${isPublic ? 'public' : 'private'} game.`);
  };

  const handleJoinWithCode = () => {
    // TODO: Implement join with code logic
    console.log(`Joining with code: ${joinCode}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Tabs defaultValue="join">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="join">Unirse a Partida</TabsTrigger>
          <TabsTrigger value="create">Crear Partida</TabsTrigger>
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
                    onChange={(e) => setJoinCode(e.target.value)}
                  />
                  <Button onClick={handleJoinWithCode} disabled={!joinCode}>Unirse</Button>
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
                {/* TODO: List public games */}
                <div className="border rounded-lg p-8 text-center text-muted-foreground">
                  <p>No hay partidas públicas disponibles en este momento.</p>
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
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
               <Button onClick={handleCreateGame} className="w-full">
                Crear Partida
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
