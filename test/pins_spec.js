'use strict';

const assert = require('assert');
const sinon = require('sinon');

const pins = require('../src/user/pins');
const db = require('../src/database');
const user = require('../src/user');
const groups = require('../src/groups');

describe('pins data model', () => {
  const uid = 101;

  let store;
  beforeEach(() => {
    // default: not admin, not instructor
    sinon.stub(user, 'isAdministrator').resolves(false);
    sinon.stub(groups, 'isMember').resolves(false);

    // simple in-memory set store mock
    store = new Map();

    sinon.stub(db, 'getSetMembers').callsFake(async (k) => {
      const s = store.get(k);
      return s ? Array.from(s) : [];
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
  });

  afterEach(() => sinon.restore());

  it('starts empty', async () => {
    const list = await pins.getPinnedTids(uid);
    assert.deepStrictEqual(list, []);
  });

  it('disallows pinning if not admin/instructor', async () => {
    await assert.rejects(pins.addPinnedTid(uid, 10), /Not authorized/);
  });

  it('allows instructor to pin up to MAX_PINS then errors', async () => {
    groups.isMember.resolves(true); // instructor
    for (let i = 1; i <= pins.MAX_PINS; i += 1) {
      await pins.addPinnedTid(uid, i);
    }
    const list = await pins.getPinnedTids(uid);
    assert.strictEqual(list.length, pins.MAX_PINS);

    await assert.rejects(pins.addPinnedTid(uid, 999), /Max pins/);
  });

  it('idempotent add and removable', async () => {
    groups.isMember.resolves(true);
    await pins.addPinnedTid(uid, 7);
    await pins.addPinnedTid(uid, 7);
    let list = await pins.getPinnedTids(uid);
    assert.deepStrictEqual(list, [7]);

    await pins.removePinnedTid(uid, 7);
    list = await pins.getPinnedTids(uid);
    assert.deepStrictEqual(list, []);
  });
});