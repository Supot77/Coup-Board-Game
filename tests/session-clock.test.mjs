import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_IDLE_LIMIT_MS,
  createStoredSessionRecord,
  advanceSessionClock,
  createSessionClock,
  getSessionClockStatus,
  resetSessionClock,
  restoreStoredSessionRecord,
  setSessionClockExempt,
} from '../src/core/sessionClock.ts';

test('warns one minute before the idle session expires', () => {
  const clock = advanceSessionClock(createSessionClock(0), SESSION_IDLE_LIMIT_MS - 60_000);
  assert.equal(getSessionClockStatus(clock).warning, true);
  assert.equal(getSessionClockStatus(clock).expired, false);
});

test('expires at 30 minutes without activity', () => {
  const clock = advanceSessionClock(createSessionClock(0), SESSION_IDLE_LIMIT_MS);
  assert.equal(getSessionClockStatus(clock).expired, true);
  assert.equal(getSessionClockStatus(clock).remainingMs, 0);
});

test('pauses idle time while another player has the action', () => {
  let clock = setSessionClockExempt(createSessionClock(0), true, 0);
  clock = advanceSessionClock(clock, SESSION_IDLE_LIMIT_MS * 4);
  assert.equal(getSessionClockStatus(clock).expired, false);
  assert.equal(getSessionClockStatus(clock).idleExempt, true);
  clock = setSessionClockExempt(clock, false, SESSION_IDLE_LIMIT_MS * 4);
  clock = advanceSessionClock(clock, SESSION_IDLE_LIMIT_MS - 1);
  assert.equal(getSessionClockStatus(clock).expired, false);
});

test('real activity restarts the 30-minute idle window', () => {
  let clock = advanceSessionClock(createSessionClock(0), SESSION_IDLE_LIMIT_MS - 2);
  clock = resetSessionClock(clock, SESSION_IDLE_LIMIT_MS - 1);
  clock = advanceSessionClock(clock, SESSION_IDLE_LIMIT_MS + 60_000);
  assert.equal(getSessionClockStatus(clock).expired, false);
  assert.equal(getSessionClockStatus(clock).warning, false);
});

test('a stored session expires after inactivity and keeps its guest display name', () => {
  const saved = createStoredSessionRecord('Guest', 1_000);
  assert.deepEqual(saved, { active: true, displayName: 'Guest', expiresAt: 1_000 + SESSION_IDLE_LIMIT_MS });
  assert.equal(restoreStoredSessionRecord(saved, 1_000 + SESSION_IDLE_LIMIT_MS - 1).active, true);
  assert.deepEqual(restoreStoredSessionRecord(saved, 1_000 + SESSION_IDLE_LIMIT_MS), {
    active: false, displayName: 'Guest', expiresAt: 1_000 + SESSION_IDLE_LIMIT_MS,
  });
});

test('logging in again with the same anonymous uid starts a fresh 30-minute clock', () => {
  const expired = createStoredSessionRecord('Guest', 0);
  assert.equal(restoreStoredSessionRecord(expired, SESSION_IDLE_LIMIT_MS).active, false);
  const resumed = createStoredSessionRecord(expired.displayName, SESSION_IDLE_LIMIT_MS + 1);
  assert.equal(resumed.active, true);
  assert.equal(resumed.displayName, 'Guest');
  assert.equal(resumed.expiresAt, SESSION_IDLE_LIMIT_MS * 2 + 1);
});
