'use client';

import { errorEmitter as firebaseErrorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type PermissionErrorContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class DataPermissionError extends Error {
  public readonly request: FirestorePermissionError['request'];

  constructor(context: PermissionErrorContext) {
    const firebaseError = new FirestorePermissionError(context);
    super(firebaseError.message);
    this.name = 'DataPermissionError';
    this.request = firebaseError.request;
  }
}

export const errorEmitter = firebaseErrorEmitter;
