import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, setPersistence, signInAnonymously, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth, authPersistence } from '../core/firebase';
import { useDialog } from './DialogProvider';
import {
  advanceSessionClock,
  createStoredSessionRecord,
  createSessionClock,
  getSessionClockStatus,
  resetSessionClock,
  restoreStoredSessionRecord,
  restoreSessionClock,
  setSessionClockExempt,
  type SessionClockState,
} from '../core/sessionClock';
import type { User } from '../types';

interface SessionStatusResponse {
  active: boolean;
  expiresAt: number;
  idleExempt: boolean;
  displayName: string;
}

interface SessionContextValue {
  authUser: FirebaseUser | null;
  isSessionReady: boolean;
  isSessionActive: boolean;
  beginSession: (displayName: string) => Promise<User>;
  recordActivity: () => void;
  setIdleExempt: (exempt: boolean) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);
const sessionKey = (uid: string) => `coup_session_${uid}`;

function readSession(uid: string): SessionStatusResponse {
  try {
    const raw = localStorage.getItem(sessionKey(uid));
    if (!raw) return { active: false, expiresAt: 0, idleExempt: false, displayName: '' };
    const record = JSON.parse(raw) as Partial<SessionStatusResponse>;
    const restored = restoreStoredSessionRecord(record, Date.now());
    return {
      active: restored.active,
      expiresAt: restored.expiresAt,
      idleExempt: false,
      displayName: restored.displayName,
    };
  } catch {
    return { active: false, expiresAt: 0, idleExempt: false, displayName: '' };
  }
}

function saveSession(uid: string, displayName: string, expiresAt: number, active = true) {
  const record = active ? createStoredSessionRecord(displayName, expiresAt - 30 * 60 * 1000) : { active, displayName, expiresAt };
  localStorage.setItem(sessionKey(uid), JSON.stringify(record));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { notify } = useDialog();
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const activeRef = useRef(false);
  const userRef = useRef<FirebaseUser | null>(null);
  const displayNameRef = useRef('');
  const clockRef = useRef<SessionClockState>(createSessionClock(Date.now()));
  const warningShown = useRef(false);

  const applySession = useCallback((user: FirebaseUser, status: SessionStatusResponse) => {
    userRef.current = user;
    displayNameRef.current = status.displayName;
    setAuthUser(user);
    activeRef.current = status.active;
    setIsSessionActive(status.active);
    clockRef.current = restoreSessionClock(Date.now(), status.expiresAt, status.idleExempt);
    warningShown.current = false;
    if (status.active && status.displayName) localStorage.setItem('coup_player_name', status.displayName);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void setPersistence(auth, authPersistence).then(() => {
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(auth, user => {
        userRef.current = user;
        setAuthUser(user);
        if (!user) {
          activeRef.current = false;
          setIsSessionActive(false);
          setIsSessionReady(true);
          return;
        }
        const status = readSession(user.uid);
        applySession(user, status);
        if (!cancelled) setIsSessionReady(true);
      });
    }).catch(() => {
      if (!cancelled) setIsSessionReady(true);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [applySession]);

  const beginSession = useCallback(async (displayName: string): Promise<User> => {
    const name = displayName.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!name) throw new Error('กรุณากรอกชื่อผู้เล่นก่อนเริ่มเล่น');
    const firebaseUser = auth.currentUser ?? (await signInAnonymously(auth)).user;
    const expiresAt = Date.now() + 30 * 60 * 1000;
    saveSession(firebaseUser.uid, name, expiresAt);
    localStorage.setItem('coup_player_name', name);
    displayNameRef.current = name;
    applySession(firebaseUser, { active: true, expiresAt, idleExempt: false, displayName: name });
    return { token: firebaseUser.uid, name };
  }, [applySession]);

  const recordActivity = useCallback(() => {
    if (!activeRef.current) return;
    const now = Date.now();
    clockRef.current = resetSessionClock(clockRef.current, now);
    warningShown.current = false;
    const user = userRef.current;
    if (!user) return;
    saveSession(user.uid, displayNameRef.current, now + 30 * 60 * 1000);
  }, []);

  const setIdleExempt = useCallback((exempt: boolean) => {
    clockRef.current = setSessionClockExempt(clockRef.current, exempt, Date.now());
    warningShown.current = false;
    const user = userRef.current;
    if (activeRef.current && user) {
      saveSession(user.uid, displayNameRef.current, Date.now() + 30 * 60 * 1000);
    }
  }, []);

  useEffect(() => {
    if (!isSessionActive) return;
    const timer = window.setInterval(() => {
      clockRef.current = advanceSessionClock(clockRef.current, Date.now());
      const status = getSessionClockStatus(clockRef.current);
      if (status.warning && !warningShown.current) {
        warningShown.current = true;
        notify('เซสชันจะหมดเวลาใน 1 นาที หากต้องการเล่นต่อ ให้แตะหรือกดแป้นใดก็ได้');
      }
      if (status.expired) {
        activeRef.current = false;
        setIsSessionActive(false);
        warningShown.current = false;
        const user = userRef.current;
        if (user) saveSession(user.uid, displayNameRef.current, Date.now(), false);
        notify('หมดเวลาใช้งานแล้ว กรุณาเข้าสู่ระบบใหม่เพื่อเล่นต่อ');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSessionActive, notify]);

  useEffect(() => {
    const onUserInput = () => recordActivity();
    document.addEventListener('pointerdown', onUserInput, { passive: true });
    document.addEventListener('keydown', onUserInput);
    return () => {
      document.removeEventListener('pointerdown', onUserInput);
      document.removeEventListener('keydown', onUserInput);
    };
  }, [recordActivity]);

  const logout = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      localStorage.removeItem(sessionKey(user.uid));
      await signOut(auth);
    }
    localStorage.removeItem('coup_player_name');
    localStorage.removeItem('coup_current_room');
    activeRef.current = false;
    setIsSessionActive(false);
  }, []);

  return <SessionContext.Provider value={{ authUser, isSessionReady, isSessionActive, beginSession, recordActivity, setIdleExempt, logout }}>
    {children}
  </SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is required');
  return context;
}
