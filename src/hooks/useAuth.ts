'use client';

import { useState, useEffect, useCallback } from 'react';
import { OUTLINE_SESSION_STORAGE_KEY } from '@/lib/outline-session';
import type { UserProfile } from '@/types/user';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setState({ user: data.user, loading: false });
      } else {
        setState({ user: null, loading: false });
      }
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem(OUTLINE_SESSION_STORAGE_KEY);
    setState({ user: null, loading: false });
    window.location.href = '/login';
  }, []);

  return { ...state, logout, refetch: fetchUser };
}
