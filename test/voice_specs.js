'use strict';

const assert = require('assert');
const sinon = require('sinon');

const voice = require('../src/user/voice');
const db = require('../src/database');
const user = require('../src/user');
const groups = require('../src/groups');

describe('voice data model', () => {
  const ownerId = 200;
  const uid = 101;
  const elevatedUid = 102;
  let store;

  beforeEach(() => {
    sinon.stub(user, 'isAdministrator').callsFake(async (id) => id === elevatedUid);
    sinon.stub(groups, 'isMember').callsFake(async (id, group) => false);
    store = new Map();
    sinon.stub(db, 'getObject').callsFake(async (k) => store.get(k) || {});
    sinon.stub(db, 'setObject').callsFake(async (k, v) => store.set(k, { ...(store.get(k) || {}), ...v }));
    sinon.stub(db, 'deleteObjectFields').callsFake(async (k, fields) => {
      const obj = store.get(k) || {};
      for (const f of fields) delete obj[f];
      store.set(k, obj);
    });
    sinon.stub(db, 'get').callsFake(async (k) => store.get(k));
    sinon.stub(db, 'set').callsFake(async (k, v) => store.set(k, v));
    sinon.stub(db, 'sortedSetAdd').callsFake(async (k, score, v) => {
      let arr = store.get(k) || [];
      arr.push({ v, score });
      arr.sort((a, b) => a.score - b.score);
      store.set(k, arr);
    });
    sinon.stub(db, 'sortedSetRemove').callsFake(async (k, v) => {
      let arr = store.get(k) || [];
      arr = arr.filter(e => e.v !== v);
      store.set(k, arr);
    });
    sinon.stub(db, 'getSortedSetRange').callsFake(async (k, start, end) => {
      const arr = store.get(k) || [];
      return arr.slice(start, end === -1 ? undefined : end + 1).map(e => e.v);
    });
    sinon.stub(db, 'setAdd').callsFake(async (k, v) => {
      const s = store.get(k) || new Set();
      s.add(v);
      store.set(k, s);
    });
    sinon.stub(db, 'setRemove').callsFake(async (k, v) => {
      const s = store.get(k) || new Set();
      s.delete(v);
      store.set(k, s);
    });
    sinon.stub(db, 'getSetMembers').callsFake(async (k) => {
      const s = store.get(k) || new Set();
      return Array.from(s);
    });
    sinon.stub(db, 'delete').callsFake(async (k) => store.delete(k));
  });

  afterEach(() => sinon.restore());

  it('should allow elevated user to set OH status', async () => {
    await voice.setOhStatus(elevatedUid, ownerId, 'active');
    assert.strictEqual(store.get(voice.ohStatusKey(ownerId)), 'active');
  });

  it('should not allow non-elevated user to set OH status', async () => {
    await assert.rejects(voice.setOhStatus(uid, ownerId, 'active'), /Not authorized/);
  });

  it('should add user to queue and then to call', async () => {
    await voice.setOhStatus(elevatedUid, ownerId, 'active');
    await voice.setPresence(uid, uid, 'in_queue', { ownerId });
    let queue = store.get(voice.ohQueueKey(ownerId));
    assert.strictEqual(queue.length, 1);
    await voice.setPresence(uid, uid, 'in_call', { ownerId });
    let call = store.get(voice.ohCallKey(ownerId));
    assert.strictEqual(call.size || call.length, 1);
  });

  it('should evict all users when OH is set to nonactive', async () => {
    await voice.setOhStatus(elevatedUid, ownerId, 'active');
    await voice.setPresence(uid, uid, 'in_queue', { ownerId });
    await voice.setPresence(elevatedUid, elevatedUid, 'in_call', { ownerId });
    await voice.setOhStatus(elevatedUid, ownerId, 'nonactive');
    const queue = store.get(voice.ohQueueKey(ownerId));
    const call = store.get(voice.ohCallKey(ownerId));
    assert.ok(!queue || queue.length === 0);
    assert.ok(!call || call.length === 0 || call.size === 0);
  });

  it('should only allow elevated user to remove from queue', async () => {
    await voice.setOhStatus(elevatedUid, ownerId, 'active');
    await voice.setPresence(uid, uid, 'in_queue', { ownerId });
    await assert.rejects(voice.removeFromQueue(uid, ownerId, uid), /Not authorized/);
    await voice.removeFromQueue(elevatedUid, ownerId, uid);
    const queue = store.get(voice.ohQueueKey(ownerId));
    assert.ok(!queue || queue.length === 0);
  });

  it('should admit next user from queue to call', async () => {
    await voice.setOhStatus(elevatedUid, ownerId, 'active');
    await voice.setPresence(uid, uid, 'in_queue', { ownerId });
    await voice.admitNext(elevatedUid, ownerId);
    const call = store.get(voice.ohCallKey(ownerId));
    assert.strictEqual(call.size || call.length, 1);
  });

  it('should reset all state with bootstrapOh', async () => {
    await voice.setOhStatus(elevatedUid, ownerId, 'active');
    await voice.setPresence(uid, uid, 'in_queue', { ownerId });
    await voice.bootstrapOh(ownerId);
    assert.strictEqual(store.get(voice.ohStatusKey(ownerId)), 'nonactive');
    assert.ok(!store.get(voice.ohQueueKey(ownerId)));
    assert.ok(!store.get(voice.ohCallKey(ownerId)));
  });
});
