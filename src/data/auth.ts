'use client';

import { useCallback } from 'react';
import { useUser, useAuth } from '@/firebase/provider';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';

export function useAuthentication() {
  const { user, isUserLoading, userError } = useUser();
  const auth = useAuth();

  const signInAnonymously = useCallback(() => {
    initiateAnonymousSignIn(auth);
  }, [auth]);

  return {
    user,
    isUserLoading,
    userError,
    signInAnonymously,
  };
}
