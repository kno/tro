'use client';

import { useCallback } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  FirestorePermissionError,
  errorEmitter,
  useCollection,
  useDoc,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import type { Match } from '@/lib/types';
import type { WithId } from '@/firebase/firestore/use-collection';

interface UpdateMatchOptions {
  merge?: boolean;
  updateTimestamp?: boolean;
}

interface CreateMatchArgs {
  playerId: string;
  isPublic: boolean;
}

interface JoinMatchArgs {
  matchId: string;
  playerId: string;
}

interface UseMatchResult {
  match: WithId<Match> | null;
  isLoading: boolean;
  error: Error | null;
}

interface UsePublicMatchesResult {
  matches: WithId<Match>[];
  isLoading: boolean;
  error: Error | null;
}

interface CreateMatchResult {
  matchId: string;
  joinCode?: string;
}

function generateJoinCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function handleDataError(
  error: unknown,
  context: { path: string; operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write'; requestResourceData?: any }
): never {
  if (error instanceof FirestorePermissionError) {
    errorEmitter.emit('permission-error', error);
    throw error;
  }

  const permissionError = new FirestorePermissionError(context);
  errorEmitter.emit('permission-error', permissionError);
  throw permissionError;
}

export function useMatch(matchId: string | null): UseMatchResult {
  const firestore = useFirestore();

  const matchRef = useMemoFirebase(() => {
    return matchId ? doc(firestore, 'matches', matchId) : null;
  }, [firestore, matchId]);

  const { data, isLoading, error } = useDoc<Match>(matchRef);

  return { match: data, isLoading, error };
}

export function usePublicMatches(limitCount = 10): UsePublicMatchesResult {
  const firestore = useFirestore();

  const publicMatchesQuery = useMemoFirebase(() => {
    return query(
      collection(firestore, 'matches'),
      where('isPublic', '==', true),
      where('status', '==', 'LOBBY'),
      limit(limitCount)
    );
  }, [firestore, limitCount]);

  const { data, isLoading, error } = useCollection<Match>(publicMatchesQuery);

  return { matches: data ?? [], isLoading, error };
}

export function useMatchActions() {
  const firestore = useFirestore();

  const createMatch = useCallback(
    async ({ playerId, isPublic }: CreateMatchArgs): Promise<CreateMatchResult> => {
      const newMatch: Omit<Match, 'id'> = {
        player1Id: playerId,
        player2Id: '',
        status: 'LOBBY',
        isPublic,
        joinCode: isPublic ? '' : generateJoinCode(),
        gameState: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        const docRef = await addDoc(collection(firestore, 'matches'), newMatch);
        return { matchId: docRef.id, joinCode: newMatch.joinCode };
      } catch (error) {
        handleDataError(error, {
          operation: 'create',
          path: 'matches',
          requestResourceData: newMatch,
        });
      }
    },
    [firestore]
  );

  const joinMatch = useCallback(
    async ({ matchId, playerId }: JoinMatchArgs) => {
      const matchRef = doc(firestore, 'matches', matchId);
      const updateData = {
        player2Id: playerId,
        status: 'PLAYING' as const,
        updatedAt: serverTimestamp(),
      };

      try {
        await updateDoc(matchRef, updateData);
      } catch (error) {
        handleDataError(error, {
          operation: 'update',
          path: `matches/${matchId}`,
          requestResourceData: updateData,
        });
      }
    },
    [firestore]
  );

  const fetchMatchByJoinCode = useCallback(
    async (joinCode: string): Promise<WithId<Match> | null> => {
      const matchesQuery = query(
        collection(firestore, 'matches'),
        where('joinCode', '==', joinCode),
        limit(1)
      );

      try {
        const snapshot = await getDocs(matchesQuery);
        if (snapshot.empty) {
          return null;
        }

        const matchDoc = snapshot.docs[0];
        return { ...(matchDoc.data() as Match), id: matchDoc.id };
      } catch (error) {
        handleDataError(error, {
          operation: 'list',
          path: 'matches',
        });
      }
    },
    [firestore]
  );

  const updateMatch = useCallback(
    async (
      matchId: string,
      data: Partial<Match>,
      options: UpdateMatchOptions = {}
    ) => {
      const { merge = true, updateTimestamp = true } = options;
      const matchRef = doc(firestore, 'matches', matchId);
      const payload = updateTimestamp
        ? { ...data, updatedAt: serverTimestamp() }
        : data;

      try {
        if (merge) {
          await setDoc(matchRef, payload, { merge: true });
        } else {
          await setDoc(matchRef, payload);
        }
      } catch (error) {
        handleDataError(error, {
          operation: 'write',
          path: `matches/${matchId}`,
          requestResourceData: payload,
        });
      }
    },
    [firestore]
  );

  const deleteMatch = useCallback(
    async (matchId: string) => {
      const matchRef = doc(firestore, 'matches', matchId);

      try {
        await deleteDoc(matchRef);
      } catch (error) {
        handleDataError(error, {
          operation: 'delete',
          path: `matches/${matchId}`,
        });
      }
    },
    [firestore]
  );

  return {
    createMatch,
    joinMatch,
    fetchMatchByJoinCode,
    updateMatch,
    deleteMatch,
  };
}
