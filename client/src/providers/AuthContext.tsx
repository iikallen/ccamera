'use client';

import { useContext, useCallback } from 'react';
import type { IUser } from '@/models/IUser';
import { Context as StoreContext } from '@/providers/StoreProvider';

type LoginCreds = { email: string; password: string };

export type AuthContextType = {
  user: IUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (creds: LoginCreds) => Promise<any>;
  registration: (creds: LoginCreds) => Promise<any>;
  logout: () => Promise<any>;
  refreshUser: () => Promise<any>;
};

export const useAuth = (): AuthContextType => {
  // берем контекст — явно приводим к ожидаемой форме, чтобы TS не ругался
  const storeCtx = useContext(StoreContext as any) as { store: any } | null;

  if (!storeCtx || !storeCtx.store) {
    throw new Error(
      'StoreProvider is missing. Make sure StoreProvider wraps the app (e.g. in app/layout.tsx).'
    );
  }

  const { store } = storeCtx;

  const login = useCallback(
    async (creds: LoginCreds) => {
      return store.login(creds.email, creds.password);
    },
    [store]
  );

  const registration = useCallback(
    async (creds: LoginCreds) => {
      return store.registration(creds.email, creds.password);
    },
    [store]
  );

  const logout = useCallback(async () => {
    return store.logout();
  }, [store]);

  const refreshUser = useCallback(async () => {
    return store.checkAuth ? store.checkAuth() : Promise.resolve(null);
  }, [store]);

  return {
    user: store.user ?? null,
    isAuthenticated: Boolean(store.isAuth),
    loading: Boolean(store.isLoading),
    login,
    registration,
    logout,
    refreshUser,
  };
};