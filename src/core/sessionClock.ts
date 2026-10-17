export const SESSION_IDLE_LIMIT_MS = 30 * 60 * 1000;
export const SESSION_WARNING_LEAD_MS = 60 * 1000;
export interface StoredSessionRecord {
  active: boolean;
  displayName: string;
  expiresAt: number;
}

export function createStoredSessionRecord(displayName: string, now: number): StoredSessionRecord {
  return { active: true, displayName, expiresAt: now + SESSION_IDLE_LIMIT_MS };
}

export function restoreStoredSessionRecord(record: Partial<StoredSessionRecord> | null, now: number): StoredSessionRecord {
  const expiresAt = Number(record?.expiresAt) || 0;
  return {
    active: record?.active === true && expiresAt > now,
    displayName: typeof record?.displayName === 'string' ? record.displayName : '',
    expiresAt,
  };
}

export interface SessionClockState {
  idleMs: number;
  lastTickAt: number;
  idleExempt: boolean;
}

export function createSessionClock(now: number, idleExempt = false): SessionClockState {
  return { idleMs: 0, lastTickAt: now, idleExempt };
}

export function restoreSessionClock(now: number, expiresAt: number, idleExempt: boolean): SessionClockState {
  const remaining = Math.max(0, expiresAt - now);
  return {
    idleMs: SESSION_IDLE_LIMIT_MS - remaining,
    lastTickAt: now,
    idleExempt,
  };
}

export function advanceSessionClock(state: SessionClockState, now: number): SessionClockState {
  const elapsed = Math.max(0, now - state.lastTickAt);
  return {
    ...state,
    idleMs: state.idleExempt ? state.idleMs : Math.min(SESSION_IDLE_LIMIT_MS, state.idleMs + elapsed),
    lastTickAt: now,
  };
}

export function resetSessionClock(state: SessionClockState, now: number): SessionClockState {
  return { idleMs: 0, lastTickAt: now, idleExempt: state.idleExempt };
}

export function setSessionClockExempt(
  state: SessionClockState,
  idleExempt: boolean,
  now: number,
): SessionClockState {
  if (idleExempt === state.idleExempt) return advanceSessionClock(state, now);
  return {
    idleMs: 0,
    lastTickAt: now,
    idleExempt,
  };
}

export function getSessionClockStatus(state: SessionClockState) {
  const expired = !state.idleExempt && state.idleMs >= SESSION_IDLE_LIMIT_MS;
  const warning = !state.idleExempt && !expired
    && state.idleMs >= SESSION_IDLE_LIMIT_MS - SESSION_WARNING_LEAD_MS;
  return {
    expired,
    warning,
    idleExempt: state.idleExempt,
    remainingMs: state.idleExempt ? SESSION_IDLE_LIMIT_MS : Math.max(0, SESSION_IDLE_LIMIT_MS - state.idleMs),
  };
}
