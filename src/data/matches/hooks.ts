'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Match } from '@/lib/types';
import { useDataServices } from '@/data/context';
import type { CreateMatchInput, CreateMatchResult } from '@/data/matches/types';

interface AsyncState<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
}

const initialCollectionState: AsyncState<Match[] | null> = {
  data: null,
  isLoading: true,
  error: null,
};

const initialMatchState: AsyncState<Match | null> = {
  data: null,
  isLoading: true,
  error: null,
};

export function usePublicMatches() {
  const { matches } = useDataServices();
  const [state, setState] = useState(initialCollectionState);

  useEffect(() => {
    setState({ ...initialCollectionState });

    const unsubscribe = matches.subscribeToPublicMatches(
      (data) => {
        setState({ data, isLoading: false, error: null });
      },
      (error) => {
        setState({ data: null, isLoading: false, error });
      },
    );

    return unsubscribe;
  }, [matches]);

  return state;
}

export function useMatch(matchId: string | null) {
  const { matches } = useDataServices();
  const [state, setState] = useState(initialMatchState);

  useEffect(() => {
    if (!matchId) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    setState({ data: null, isLoading: true, error: null });

    const unsubscribe = matches.subscribeToMatch(
      matchId,
      (data) => {
        setState({ data, isLoading: false, error: null });
      },
      (error) => {
        setState({ data: null, isLoading: false, error });
      },
    );

    return unsubscribe;
  }, [matches, matchId]);

  return state;
}

export function useMatchesActions() {
  const { matches } = useDataServices();

  const createMatch = useCallback(
    (input: CreateMatchInput): Promise<CreateMatchResult> => matches.createMatch(input),
    [matches],
  );

  const findMatchByJoinCode = useCallback(
    (joinCode: string) => matches.findMatchByJoinCode(joinCode),
    [matches],
  );

  const joinMatch = useCallback(
    (matchId: string, playerId: string) => matches.joinMatch(matchId, playerId),
    [matches],
  );

  const updateMatch = useCallback(
    (matchId: string, data: Partial<Omit<Match, 'id'>>) => matches.updateMatch(matchId, data),
    [matches],
  );

  const mergeMatch = useCallback(
    (matchId: string, data: Partial<Omit<Match, 'id'>>) => matches.mergeMatch(matchId, data),
    [matches],
  );

  const deleteMatch = useCallback(
    (matchId: string) => matches.deleteMatch(matchId),
    [matches],
  );

  return useMemo(
    () => ({
      createMatch,
      findMatchByJoinCode,
      joinMatch,
      updateMatch,
      mergeMatch,
      deleteMatch,
    }),
    [createMatch, findMatchByJoinCode, joinMatch, updateMatch, mergeMatch, deleteMatch],
  );
}
