import type { ReactNode } from 'react';

const scenario = new URLSearchParams(location.search).get('scenario');
const active = scenario !== 'login';
const value = {
  authUser: active ? { uid: 'player1' } : null,
  isSessionReady: true,
  isSessionActive: active,
  beginSession: async (name: string) => ({ token: 'player1', name }),
  recordActivity: () => {},
  setIdleExempt: () => {},
  logout: async () => {},
};
export function SessionProvider({ children }: { children: ReactNode }) { return children; }
export function useSession() { return value; }
