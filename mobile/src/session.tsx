// Who is signed in, and whether onboarding was seen. Loaded once from the device, then kept in memory.

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import * as api from './fairdrive';
import { LoggedOut, Session } from './fairdrive';
import { storage } from './storage';

type State = {
  ready: boolean;
  onboarded: boolean;
  session: Session | null;
  finishOnboarding: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Runs an API call with the session; an expired sign-in signs the driver out instead of throwing. */
  call: <T>(fn: (session: Session) => Promise<T>) => Promise<T>;
};

const SessionContext = createContext<State | null>(null);

export function useSession(): State {
  const state = useContext(SessionContext);
  if (!state) throw new Error('useSession must be used inside <SessionProvider>');
  return state;
}

/** The signed-in session, for screens that only open once signed in. */
export function useSignedIn(): Session {
  const { session } = useSession();
  if (!session) throw new Error('This screen needs a signed-in driver');
  return session;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    Promise.all([storage.get('onboarded'), storage.get('session')]).then(([seen, saved]) => {
      setOnboarded(seen === 'yes');
      setSession(saved ? JSON.parse(saved) : null);
      setReady(true);
    });
  }, []);

  async function keep(token: string, driver: api.Driver) {
    const next = { token, driver };
    await storage.set('session', JSON.stringify(next));
    setSession(next);
  }

  const forget = useCallback(async () => {
    await storage.remove('session');
    setSession(null);
  }, []);

  // Stable until the session changes, so screens can load data in effects that depend on it.
  const call = useCallback(async <T,>(fn: (session: Session) => Promise<T>): Promise<T> => {
    try {
      return await fn(session!);
    } catch (e) {
      if (e instanceof LoggedOut) await forget();
      throw e;
    }
  }, [session, forget]);

  const state: State = {
    ready, onboarded, session,
    finishOnboarding: async () => {
      await storage.set('onboarded', 'yes');
      setOnboarded(true);
    },
    signIn: async (email, password) => {
      const { token, driver } = await api.signIn(email.trim(), password);
      await keep(token, driver);
    },
    signUp: async (name, email, password) => {
      const { token, driver } = await api.signUp(name.trim(), email.trim(), password);
      await keep(token, driver);
    },
    signOut: async () => {
      await api.signOut(session!).catch((e) => { if (!(e instanceof LoggedOut)) throw e; });
      await forget();
    },
    deleteAccount: async () => {
      await api.deleteAccount(session!);
      await forget();
    },
    call,
  };
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
