// Who is signed in, and whether onboarding was seen. Loaded once from the device, then kept in memory.

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import * as api from './fairdrive';
import { LoggedOut, Session, serverUrl } from './fairdrive';
import { storage } from './storage';

type State = {
  ready: boolean;
  onboarded: boolean;
  session: Session | null;
  lastServer: string;
  finishOnboarding: () => Promise<void>;
  signIn: (server: string, email: string, password: string) => Promise<void>;
  signUp: (server: string, name: string, email: string, password: string) => Promise<void>;
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
  const [lastServer, setLastServer] = useState('');

  useEffect(() => {
    Promise.all([storage.get('onboarded'), storage.get('session'), storage.get('server')]).then(([seen, saved, server]) => {
      setOnboarded(seen === 'yes');
      setSession(saved ? JSON.parse(saved) : null);
      setLastServer(server ?? '');
      setReady(true);
    });
  }, []);

  async function keep(server: string, token: string, driver: api.Driver) {
    const next = { server, token, driver };
    await storage.set('session', JSON.stringify(next));
    await storage.set('server', server);
    setLastServer(server);
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
    ready, onboarded, session, lastServer,
    finishOnboarding: async () => {
      await storage.set('onboarded', 'yes');
      setOnboarded(true);
    },
    signIn: async (typed, email, password) => {
      const server = serverUrl(typed);
      const { token, driver } = await api.signIn(server, email.trim(), password);
      await keep(server, token, driver);
    },
    signUp: async (typed, name, email, password) => {
      const server = serverUrl(typed);
      const { token, driver } = await api.signUp(server, name.trim(), email.trim(), password);
      await keep(server, token, driver);
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
