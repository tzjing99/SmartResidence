'use client';

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { performSignOut } from './sign-out';

export function useSignOut() {
  const queryClient = useQueryClient();
  return React.useCallback(() => performSignOut(queryClient), [queryClient]);
}
