// Auth context — wraps Supabase session state, exposes useSession / useUser /
// signIn / signOut. Mounted near the root by main.tsx.
//
// Email redirect convention (issue #2 from DEV_HANDOFF):
// Every Supabase Auth call that triggers an email (resetPasswordForEmail,
// signInWithOtp, public signUp) MUST pass `emailRedirectTo` / `redirectTo`
// derived from `window.location.origin`. The Supabase project's Site URL
// is staging — without an explicit per-call override, links from local dev
// would always send the user to staging. Use `authRedirectUrl()` below.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

interface AuthApi extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

/**
 * Origin-aware redirect URL for Supabase Auth email flows.
 * Returns e.g. `http://localhost:5173/auth/callback` in dev,
 * `https://cadeirapro-dashboard.pages.dev/auth/callback` in staging.
 * Both are listed in Supabase → Auth → URL Configuration → Redirect URLs.
 */
export function authRedirectUrl(path = '/auth/callback'): string {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, user: null, loading: true });

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | null = null;

    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    });

    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false });
    });
    unsub = sub.data.subscription;

    return () => {
      unsub?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl('/login'),
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useSession() {
  return useAuth().session;
}

export function useUser() {
  return useAuth().user;
}
