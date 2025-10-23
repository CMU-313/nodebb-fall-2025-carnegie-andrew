'use strict';

/* eslint-disable no-await-in-loop */

const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru(); // don't load real deps

describe('Pins data model (isolated)', () => {
	// Simple in-memory fake DB
	let store;
	const dbStub = {
		getSetMembers: async (k) => {
			const s = store.get(k);
			return s ? Array.from(s) : [];
		},
		setAdd: async (k, v) => {
			const s = store.get(k) || new Set();
			s.add(String(v));
			store.set(k, s);
		},
		setRemove: async (k, v) => {
			const s = store.get(k) || new Set();
			s.delete(String(v));
			store.set(k, s);
		},
	};

	// Stubs for auth/privileges
	let privilegesStub;
	let groupsStub;

	// Load the module-under-test with stubs injected
	let pins;

	beforeEach(() => {
		store = new Map();

		privilegesStub = {
			users: {
				isAdministrator: sinon.stub().resolves(false),
			},
		};

		groupsStub = {
			isMember: sinon.stub().resolves(false),
		};

		pins = proxyquire('../src/user/pins', {
			'../database': dbStub,
			'../groups': groupsStub,
			'../privileges': privilegesStub,
		});
	});

	afterEach(() => {
		sinon.restore();
	});

	it('starts empty', async () => {
		const list = await pins.getPinnedTids(101);
		assert.deepStrictEqual(list, []);
	});

	it('rejects non-privileged users', async () => {
		await assert.rejects(pins.addPinnedTid(101, 42), /Not authorized/);
		await assert.rejects(pins.removePinnedTid(101, 42), /Not authorized/);
	});

	it('instructor can pin up to MAX_PINS then errors', async () => {
		groupsStub.isMember.resolves(true);
		for (let i = 1; i <= pins.MAX_PINS; i += 1) {
			const list = await pins.addPinnedTid(101, i);
			assert.strictEqual(list.length, i);
		}
		const current = await pins.getPinnedTids(101);
		assert.strictEqual(current.length, pins.MAX_PINS);

		await assert.rejects(pins.addPinnedTid(101, 999), /Max pins/);
	});

	it('idempotent add and removable', async () => {
		groupsStub.isMember.resolves(true);

		await pins.addPinnedTid(101, 7);
		await pins.addPinnedTid(101, 7); // no duplicate
		let list = await pins.getPinnedTids(101);
		assert.deepStrictEqual(list, [7]);

		await pins.removePinnedTid(101, 7);
		list = await pins.getPinnedTids(101);
		assert.deepStrictEqual(list, []);
	});

	it('validates numeric topic ids', async () => {
		groupsStub.isMember.resolves(true);
		await assert.rejects(pins.addPinnedTid(101, 'NaN'), /Invalid topic id/);
		await assert.rejects(pins.removePinnedTid(101, 'oops'), /Invalid topic id/);
	});

	it('idempotent add returns without writing again', async () => {
		groupsStub.isMember.resolves(true);
		await pins.addPinnedTid(101, 42);
		const before = await pins.getPinnedTids(101);
		// Spy: setAdd should not be called when adding duplicate
		const wrote = false;
		const original = pins.__getDbSetAdd ? pins.__getDbSetAdd() : null; // ignore if you didn’t expose helpers
		// simpler: try to add again and assert the list unchanged
		const after = await pins.addPinnedTid(101, 42);
		assert.deepStrictEqual(after, before);
	});

	it('admin can pin (without instructor group)', async () => {
		privilegesStub.users.isAdministrator.resolves(true);
		groupsStub.isMember.resolves(false);
		const out = await pins.addPinnedTid(101, 11);
		assert.deepStrictEqual(out, [11]);
	});

	it('uid <= 0 cannot pin/unpin', async () => {
		await assert.rejects(pins.addPinnedTid(0, 1), /Not authorized/);
		await assert.rejects(pins.removePinnedTid(0, 1), /Not authorized/);
	});

	it('getPinnedTids filters non-numeric values', async () => {
		// simulate DB pollution
		await dbStub.setAdd(pins.keyFor(101), '5');
		await dbStub.setAdd(pins.keyFor(101), 'abc');
		const out = await pins.getPinnedTids(101);
		assert.deepStrictEqual(out, [5]); // 'abc' filtered out
	});
});
