import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, query, serverTimestamp, updateDoc, where, setDoc, type QueryDocumentSnapshot, type DocumentSnapshot } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Match } from '@/lib/types';
import type { MatchesService, CreateMatchInput, CreateMatchResult } from '@/data/matches/types';
import { errorEmitter, DataPermissionError } from '@/data/shared-errors';

function mapMatchSnapshot(snapshot: DocumentSnapshot | QueryDocumentSnapshot): Match {
  const data = snapshot.data() as Match | undefined;

  if (!data) {
    throw new Error('Match data is undefined');
  }

  return { ...data, id: snapshot.id };
}

export class FirebaseMatchesService implements MatchesService {
  constructor(private readonly firestore: Firestore) {}

  subscribeToPublicMatches(onData: (matches: Match[]) => void, onError: (error: Error) => void) {
    const publicMatchesQuery = query(
      collection(this.firestore, 'matches'),
      where('isPublic', '==', true),
      where('status', '==', 'LOBBY'),
      limit(10),
    );

    return onSnapshot(
      publicMatchesQuery,
      (snapshot) => {
        const matches = snapshot.docs.map((docSnapshot) => mapMatchSnapshot(docSnapshot));
        onData(matches);
      },
      (error) => {
        const contextualError = new DataPermissionError({ path: 'matches', operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        onError(contextualError);
      },
    );
  }

  subscribeToMatch(matchId: string, onData: (match: Match | null) => void, onError: (error: Error) => void) {
    const matchRef = doc(this.firestore, 'matches', matchId);

    return onSnapshot(
      matchRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          onData(null);
          return;
        }
        onData(mapMatchSnapshot(snapshot));
      },
      () => {
        const contextualError = new DataPermissionError({ path: `matches/${matchId}`, operation: 'get' });
        errorEmitter.emit('permission-error', contextualError);
        onError(contextualError);
      },
    );
  }

  async createMatch(input: CreateMatchInput): Promise<CreateMatchResult> {
    const newMatch: Omit<Match, 'id'> = {
      player1Id: input.playerId,
      player2Id: '',
      status: 'LOBBY',
      isPublic: input.isPublic,
      joinCode: input.isPublic ? '' : this.generateJoinCode(),
      gameState: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(this.firestore, 'matches'), newMatch);
      return { matchId: docRef.id, joinCode: newMatch.joinCode };
    } catch (error) {
      const contextualError = new DataPermissionError({ path: 'matches', operation: 'create', requestResourceData: newMatch });
      errorEmitter.emit('permission-error', contextualError);
      throw contextualError;
    }
  }

  async findMatchByJoinCode(joinCode: string): Promise<Match | null> {
    const joinQuery = query(
      collection(this.firestore, 'matches'),
      where('joinCode', '==', joinCode),
      limit(1),
    );

    try {
      const snapshot = await getDocs(joinQuery);

      if (snapshot.empty) {
        return null;
      }

      return mapMatchSnapshot(snapshot.docs[0]);
    } catch (error) {
      const contextualError = new DataPermissionError({ path: 'matches', operation: 'list' });
      errorEmitter.emit('permission-error', contextualError);
      throw contextualError;
    }
  }

  async joinMatch(matchId: string, playerId: string): Promise<void> {
    const update = {
      player2Id: playerId,
      status: 'PLAYING' as const,
      updatedAt: serverTimestamp(),
    } satisfies Partial<Omit<Match, 'id'>>;

    try {
      await updateDoc(doc(this.firestore, 'matches', matchId), update);
    } catch (error) {
      const contextualError = new DataPermissionError({ path: `matches/${matchId}`, operation: 'update', requestResourceData: update });
      errorEmitter.emit('permission-error', contextualError);
      throw contextualError;
    }
  }

  async updateMatch(matchId: string, data: Partial<Omit<Match, 'id'>>): Promise<void> {
    const payload = {
      ...data,
      updatedAt: data.updatedAt ?? serverTimestamp(),
    } satisfies Partial<Omit<Match, 'id'>>;

    try {
      await updateDoc(doc(this.firestore, 'matches', matchId), payload);
    } catch (error) {
      const contextualError = new DataPermissionError({ path: `matches/${matchId}`, operation: 'update', requestResourceData: payload });
      errorEmitter.emit('permission-error', contextualError);
      throw contextualError;
    }
  }

  async mergeMatch(matchId: string, data: Partial<Omit<Match, 'id'>>): Promise<void> {
    const payload = {
      ...data,
      updatedAt: data.updatedAt ?? serverTimestamp(),
    } satisfies Partial<Omit<Match, 'id'>>;

    try {
      await setDoc(doc(this.firestore, 'matches', matchId), payload, { merge: true });
    } catch (error) {
      const contextualError = new DataPermissionError({ path: `matches/${matchId}`, operation: 'write', requestResourceData: payload });
      errorEmitter.emit('permission-error', contextualError);
      throw contextualError;
    }
  }

  async deleteMatch(matchId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, 'matches', matchId));
    } catch (error) {
      const contextualError = new DataPermissionError({ path: `matches/${matchId}`, operation: 'delete' });
      errorEmitter.emit('permission-error', contextualError);
      throw contextualError;
    }
  }

  private generateJoinCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
