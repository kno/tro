'use client';

import { ReactNode, useMemo } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useFirebase } from '@/firebase/provider';
import { FirebaseMatchesService } from '@/data/matches/services/firebase';
import { DataServicesProvider } from '@/data/context';

function FirebaseDataBridge({ children }: { children: ReactNode }) {
  const { firestore } = useFirebase();

  const services = useMemo(() => ({
    matches: new FirebaseMatchesService(firestore),
  }), [firestore]);

  return <DataServicesProvider value={services}>{children}</DataServicesProvider>;
}

export function DataProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseClientProvider>
      <FirebaseDataBridge>{children}</FirebaseDataBridge>
    </FirebaseClientProvider>
  );
}
