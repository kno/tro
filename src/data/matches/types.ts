import type { Match } from '@/lib/types';

export interface CreateMatchInput {
  playerId: string;
  isPublic: boolean;
}

export interface CreateMatchResult {
  matchId: string;
  joinCode?: string;
}

export interface MatchesService {
  subscribeToPublicMatches(
    onData: (matches: Match[]) => void,
    onError: (error: Error) => void,
  ): () => void;
  subscribeToMatch(
    matchId: string,
    onData: (match: Match | null) => void,
    onError: (error: Error) => void,
  ): () => void;
  createMatch(input: CreateMatchInput): Promise<CreateMatchResult>;
  findMatchByJoinCode(joinCode: string): Promise<Match | null>;
  joinMatch(matchId: string, playerId: string): Promise<void>;
  updateMatch(matchId: string, data: Partial<Omit<Match, 'id'>>): Promise<void>;
  mergeMatch(matchId: string, data: Partial<Omit<Match, 'id'>>): Promise<void>;
  deleteMatch(matchId: string): Promise<void>;
}
