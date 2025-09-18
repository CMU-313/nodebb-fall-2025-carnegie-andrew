'use strict';

const db = require('../database');
const user = require('./index');
const groups = require('../groups');

const ELEVATED_GROUPS = ['instructors', 'oh_managers']; // tweak to your needs

// --- Voice State ---
// voiceState: { [userId]: { presence, oh_status, perms } }
// voiceQueue: [userId, ...] (order matters)
// All mutating actions go through helpers below.

// Example in-memory (for illustration; actual storage is in db):
// const voiceState = { '123': { presence: 'in_call', oh_status: 'active', perms: true }, ... };
// let voiceQueue = ['123', '456', ...];

// ---------- helpers ----------

async function hasElevated(uid) {
  // Returns true if user has elevated permissions
  const [isAdmin, groupFlags] = await Promise.all([
    user.isAdministrator(uid),
    Promise.all(ELEVATED_GROUPS.map(g => groups.isMember(uid, g))),
  ]);
  return Boolean(isAdmin || groupFlags.some(Boolean));
}

function ukey(uid)           { return `user:${uid}`; }
function ohStatusKey(oid)    { return `oh:${oid}:status`; }
function ohQueueKey(oid)     { return `oh:${oid}:queue`; }  // ZSET (for FIFO or priority)
function ohCallKey(oid)      { return `oh:${oid}:call`; }   // SET
function roomMembersKey(oid) { return `room:${oid}:members`; }
const PRES_INQ  = 'presence:in_queue';
const PRES_INC  = 'presence:in_call';

// NB: using OBJECT-ish helpers via db, modeled after NodeBB API

async function getUser(uid) {
  // Returns user state (no redundant user_id)
  const obj = await db.getObject(ukey(uid)) || {};
  return {
    presence:  obj.presence || 'none',   // none|in_queue|in_call
    roomOwner: obj.room_owner || null,
    callId:    obj.call_id || null,
    ohStatus:  obj.oh_status || null,
    perms:     obj.perms === 'true' || obj.perms === true, // store as boolean
  };
}


// Updates user state with the given patch object
async function patchUser(uid, patch) {
  await db.setObject(ukey(uid), patch);
}


// Removes specified fields from the user's state
async function clearUserFields(uid, fields) {
  await db.deleteObjectFields(ukey(uid), fields); // NodeBB has deleteObjectField(s); fallback: iterate
}

// ---------- presence state machine ----------
/**
 * setPresence(actorUid, targetUid, nextPresence, { ownerId?, callId? })
 * nextPresence: 'none' | 'in_queue' | 'in_call'
 */

async function setPresence(actorUid, targetUid, nextPresence, opts = {}) {
  // Only elevated users can change others' presence
  const sameUser = String(actorUid) === String(targetUid);
  if (!sameUser && !(await hasElevated(actorUid))) {
    const err = new Error('Not authorized to change another user’s presence');
    err.status = 403; throw err;
  }

  const now = Date.now();
  const { presence: prevPresence, roomOwner: prevOwner } = await getUser(targetUid);

  // 1) Clean up previous indexes
  if (prevPresence === 'in_queue' && prevOwner) {
    await Promise.all([
      db.sortedSetRemove(ohQueueKey(prevOwner), String(targetUid)),
      db.setRemove(PRES_INQ, String(targetUid)),
      db.setRemove(roomMembersKey(prevOwner), String(targetUid)),
    ]);
  }
  if (prevPresence === 'in_call' && prevOwner) {
    await Promise.all([
      db.setRemove(ohCallKey(prevOwner), String(targetUid)),
      db.setRemove(PRES_INC, String(targetUid)),
      db.setRemove(roomMembersKey(prevOwner), String(targetUid)),
    ]);
  }

  // 2) Apply new state
  let ownerId = null;
  let callId  = null;

  if (nextPresence === 'in_queue') {
    ownerId = opts.ownerId;
    if (!ownerId) {
      const err = new Error('ownerId required to enter a queue');
      err.status = 400; throw err;
    }
    const status = await db.get(ohStatusKey(ownerId));
    if (status !== 'active') {
      const err = new Error('Office hours are not active');
      err.status = 409; throw err;
    }
    // FIFO with score = now (or priority if you pass a different score)
    await Promise.all([
      db.sortedSetAdd(ohQueueKey(ownerId), now, String(targetUid)),
      db.setAdd(PRES_INQ, String(targetUid)),
      db.setAdd(roomMembersKey(ownerId), String(targetUid)),
      patchUser(targetUid, {
        presence: 'in_queue',
        room_owner: String(ownerId),
        updated_at: String(now),
      }),
    ]);
  } else if (nextPresence === 'in_call') {
    ownerId = opts.ownerId;
    callId  = opts.callId || `call:${ownerId}`;
    if (!ownerId) {
      const err = new Error('ownerId required to enter a call');
      err.status = 400; throw err;
    }
    const status = await db.get(ohStatusKey(ownerId));
    if (status !== 'active') {
      const err = new Error('Office hours are not active');
      err.status = 409; throw err;
    }
    await Promise.all([
      db.setAdd(ohCallKey(ownerId), String(targetUid)),
      db.setAdd(PRES_INC, String(targetUid)),
      db.setAdd(roomMembersKey(ownerId), String(targetUid)),
      patchUser(targetUid, {
        presence: 'in_call',
        room_owner: String(ownerId),
        call_id: String(callId),
        updated_at: String(now),
      }),
    ]);
  } else if (nextPresence === 'none') {
    await Promise.all([
      clearUserFields(targetUid, ['room_owner', 'call_id']),
      patchUser(targetUid, { presence: 'none', updated_at: String(now) }),
    ]);
  } else {
    const err = new Error('Invalid presence');
    err.status = 400; throw err;
  }

  return { uid: String(targetUid), presence: nextPresence, ownerId, callId };
}

// Pop next from queue and admit to call

// Remove a user from the queue and shift others up
// Removes a user from the queue and clears their state
async function removeFromQueue(actorUid, ownerId, userId) {
  if (!(await hasElevated(actorUid))) {
    const err = new Error('Not authorized to remove from queue');
    err.status = 403; throw err;
  }
  await db.sortedSetRemove(ohQueueKey(ownerId), String(userId));
  // No need to shift, as sorted sets maintain order by score
  await patchUser(userId, { presence: 'none', updated_at: String(Date.now()) });
  await clearUserFields(userId, ['room_owner', 'call_id']);
}

// Admit next user in queue to call
// Admits the next user in the queue to the call
async function admitNext(actorUid, ownerId, callId = `call:${ownerId}`) {
  if (!(await hasElevated(actorUid)) && String(actorUid) !== String(ownerId)) {
    const err = new Error('Not authorized to admit');
    err.status = 403; throw err;
  }
  const next = await db.getSortedSetRange(ohQueueKey(ownerId), 0, 0);
  if (!next || !next.length) return null;
  const targetUid = next[0];
  await Promise.all([
    db.sortedSetRemove(ohQueueKey(ownerId), targetUid),
    db.setAdd(ohCallKey(ownerId), targetUid),
    db.setRemove(PRES_INQ, targetUid),
    db.setAdd(PRES_INC, targetUid),
    db.setAdd(roomMembersKey(ownerId), targetUid),
    patchUser(targetUid, {
      presence: 'in_call',
      room_owner: String(ownerId),
      call_id: String(callId),
      updated_at: String(Date.now()),
    }),
  ]);
  return { admittedUid: targetUid, ownerId, callId };
}

// ---------- OH status ----------
// Sets the office hours status and evicts users if deactivated
async function setOhStatus(actorUid, ownerId, newStatus) {
  if (newStatus !== 'active' && newStatus !== 'nonactive') {
    const err = new Error('Invalid OH status');
    err.status = 400; throw err;
  }
  // Only elevated users can change OH status
  if (!(await hasElevated(actorUid))) {
    const err = new Error('Not authorized to change OH status');
    err.status = 403; throw err;
  }
  await Promise.all([
    db.set(ohStatusKey(ownerId), newStatus),
    patchUser(ownerId, { oh_status: newStatus, updated_at: String(Date.now()) }),
  ]);
  // If turning off, evict everyone from call and queue
  if (newStatus === 'nonactive') {
    const [callMembers, queueMembers] = await Promise.all([
      db.getSetMembers(ohCallKey(ownerId)),
      db.getSortedSetRange(ohQueueKey(ownerId), 0, -1),
    ]);
    await Promise.all([
      db.delete(ohCallKey(ownerId)),
      db.delete(ohQueueKey(ownerId)),
      ...callMembers.map(uid => db.setRemove(PRES_INC, uid)),
      ...queueMembers.map(uid => db.setRemove(PRES_INQ, uid)),
      db.delete(roomMembersKey(ownerId)),
    ]);
    await Promise.all(
      [...callMembers, ...queueMembers].map(uid =>
        patchUser(uid, { presence: 'none', updated_at: String(Date.now()) })
          .then(() => clearUserFields(uid, ['room_owner', 'call_id']))
      )
    );
    return { ownerId, status: newStatus, affected: callMembers.length + queueMembers.length };
  }
  return { ownerId, status: newStatus, affected: 0 };
}

// ---------- bootstrap ----------
// Resets all OH state for the given owner to nonactive and clears all queues/calls
async function bootstrapOh(ownerId) {
  const now = Date.now();
  await Promise.all([
    db.set(ohStatusKey(ownerId), 'nonactive'),
    patchUser(ownerId, { oh_status: 'nonactive', updated_at: String(now) }),
    db.delete(ohQueueKey(ownerId)),
    db.delete(ohCallKey(ownerId)),
    db.delete(roomMembersKey(ownerId)),
  ]);
}

module.exports = {
  hasElevated,
  setPresence,
  admitNext,
  setOhStatus,
  bootstrapOh,
  removeFromQueue,
};
