'use client';

import { createContext, useContext } from 'react';
import type { MatchesService } from '@/data/matches/types';

export interface DataServices {
  matches: MatchesService;
}

const DataContext = createContext<DataServices | null>(null);

export function DataServicesProvider({
  value,
  children,
}: {
  value: DataServices;
  children: React.ReactNode;
}) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataServices(): DataServices {
  const context = useContext(DataContext);

  if (!context) {
    throw new Error('useDataServices must be used within a DataServicesProvider');
  }

  return context;
}
