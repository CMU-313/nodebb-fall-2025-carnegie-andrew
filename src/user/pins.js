'use strict';

// Adjust these requires if your project paths differ:
const db = require('../database');
const user = require('./index');        // NodeBB's user helpers live in src/user
const groups = require('../groups');    // Group membership checks

const MAX_PINS = 5;
const INSTRUCTOR_GROUP = 'instructors'; // change if your course uses a different name

async function canPin(uid) {
  const [isAdmin, isInstructor] = await Promise.all([
    user.isAdministrator(uid),
    groups.isMember(uid, INSTRUCTOR_GROUP),
  ]);
  return Boolean(isAdmin || isInstructor);
}

function keyFor(uid) {
  return `user:${uid}:pinnedTids`;
}

async function getPinnedTids(uid) {
  const tids = await db.getSetMembers(keyFor(uid));
  return (tids || []).map((t) => Number(t)).filter((n) => Number.isFinite(n));
}

async function addPinnedTid(uid, tid) {
  if (!(await canPin(uid))) {
    const err = new Error('Not authorized to pin');
    err.status = 403;
    throw err;
  }

  const normalized = Number(tid);
  if (!Number.isFinite(normalized)) {
    const err = new Error('Invalid topic id');
    err.status = 400;
    throw err;
  }

  const current = await getPinnedTids(uid);
  if (current.includes(normalized)) {
    return current; // idempotent
  }
  if (current.length >= MAX_PINS) {
    const err = new Error(`Max pins (${MAX_PINS}) reached`);
    err.status = 400;
    throw err;
  }

  await db.setAdd(keyFor(uid), String(normalized));
  return getPinnedTids(uid);
}

async function removePinnedTid(uid, tid) {
  if (!(await canPin(uid))) {
    const err = new Error('Not authorized to unpin');
    err.status = 403;
    throw err;
  }

  const normalized = Number(tid);
  if (!Number.isFinite(normalized)) {
    const err = new Error('Invalid topic id');
    err.status = 400;
    throw err;
  }

  await db.setRemove(keyFor(uid), String(normalized));
  return getPinnedTids(uid);
}

module.exports = {
  MAX_PINS,
  canPin,
  getPinnedTids,
  addPinnedTid,
  removePinnedTid,
};