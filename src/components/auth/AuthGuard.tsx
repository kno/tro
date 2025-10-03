'use client';

import { useAuthentication } from '@/data';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isUserLoading, signInAnonymously } = useAuthentication();

  useEffect(() => {
    if (!isUserLoading && !user) {
      signInAnonymously();
    }
  }, [user, isUserLoading, signInAnonymously]);

  if (isUserLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Autenticando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
