'use strict';

const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Anonymous Backend (isolated)', () => {
	let store, metaStub, topicsStub, privilegesStub, anonymous;
	
	const dbStub = {
		setObject: async (k, v) => store.set(k, v),
		getObject: async (k) => store.get(k) || null,
		sortedSetAdd: async (k, score, v) => {
			const set = store.get(`${k}:sorted`) || [];
			set.push({ score, value: v });
			store.set(`${k}:sorted`, set);
		},
		getSortedSetRevRange: async (k) => (store.get(`${k}:sorted`) || []).map(item => item.value),
	};

	beforeEach(() => {
		store = new Map();
		metaStub = { config: { allowAnonymousPosts: 1 } };
		topicsStub = {
			post: sinon.stub().resolves({ postData: { pid: 123 } }),
			reply: sinon.stub().resolves({ pid: 456 }),
		};
		privilegesStub = { categories: { can: sinon.stub().resolves(true) } };
		
		anonymous = proxyquire('../src/anonymous/index', {
			'../database': dbStub,
			'../meta': metaStub,
			'../topics': topicsStub,
			'../privileges': privilegesStub,
		});
	});

	afterEach(() => sinon.restore());

	it('manages configuration and constants', () => {
		assert.strictEqual(anonymous.ANONYMOUS_UID, 0);
		assert.strictEqual(anonymous.isEnabled(), true);
		metaStub.config.allowAnonymousPosts = 0;
		assert.strictEqual(anonymous.isEnabled(), false);
	});

	it('generates deterministic handles', async () => {
		const handle1 = await anonymous.generateAnonymousHandle(123);
		const handle2 = await anonymous.generateAnonymousHandle(123);
		const handle3 = await anonymous.generateAnonymousHandle(456);
		assert.strictEqual(handle1, handle2);
		assert.notStrictEqual(handle1, handle3);
		assert(handle1.startsWith('Anonymous_'));
	});

	it('validates anonymous posting permissions', async () => {
		assert.strictEqual(await anonymous.canPostAnonymously(0, 1), false);
		assert.strictEqual(await anonymous.canPostAnonymously(-1, 1), false);
		
		privilegesStub.categories.can.resolves(false);
		assert.strictEqual(await anonymous.canPostAnonymously(123, 1), false);
		
		privilegesStub.categories.can.resolves(true);
		assert.strictEqual(await anonymous.canPostAnonymously(123, 1), true);
	});

	it('creates topics with proper anonymization', async () => {
		const normalData = { uid: 123, anonymous: false, title: 'Test' };
		const anonData = { uid: 123, anonymous: true, title: 'Test' };
		
		await anonymous.createTopic(normalData);
		assert(topicsStub.post.calledWith(normalData));
		
		await anonymous.createTopic(anonData);
		const callArgs = topicsStub.post.secondCall.args[0];
		assert.strictEqual(callArgs.uid, 0);
		assert(callArgs.handle.startsWith('Anonymous_'));
		assert.strictEqual(store.get('post:123:anonymous').originalUid, 123);
	});

	it('creates replies with proper anonymization', async () => {
		const normalData = { uid: 123, anonymous: false, tid: 1, content: 'Reply' };
		const anonData = { uid: 123, anonymous: true, tid: 1, content: 'Reply' };
		
		await anonymous.createReply(normalData);
		assert(topicsStub.reply.calledWith(normalData));
		
		await anonymous.createReply(anonData);
		const callArgs = topicsStub.reply.secondCall.args[0];
		assert.strictEqual(callArgs.uid, 0);
		assert(callArgs.handle.startsWith('Anonymous_'));
		assert.strictEqual(store.get('post:456:anonymous').originalUid, 123);
	});

	it('manages anonymous mappings', async () => {
		await dbStub.setObject('post:456:anonymous', { originalUid: '123' });
		assert.strictEqual(await anonymous.getOriginalUid(456), 123);
		assert.strictEqual(await anonymous.getOriginalUid(999), null);
		
		await anonymous.storeAnonymousMapping(123, { uid: 0, handle: 'Anonymous_test' });
		const stored = store.get('uid:123:anonymous:posts:sorted');
		assert.strictEqual(JSON.parse(stored[0].value).uid, 0);
	});

	it('retrieves anonymous posts by user', async () => {
		const testData = JSON.stringify({ uid: 0, handle: 'Anonymous_test' });
		await dbStub.sortedSetAdd('uid:123:anonymous:posts', Date.now(), testData);
		
		const result = await anonymous.getAnonymousPostsByUser(123);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].uid, 0);
		
		const empty = await anonymous.getAnonymousPostsByUser(999);
		assert.deepStrictEqual(empty, []);
	});

	it('handles composer build filtering', async () => {
		const withTemplate = { templateData: {}, req: { uid: 123, query: { cid: 1 } } };
		const noUid = { templateData: {}, req: { query: { cid: 1 } } };
		const noTemplate = { req: { uid: 123 } };
		
		const result1 = await anonymous.filterComposerBuild(withTemplate);
		assert.strictEqual(result1.templateData.showAnonymousOption, true);
		assert.strictEqual(result1.templateData.canPostAnonymously, true);
		
		const result2 = await anonymous.filterComposerBuild(noUid);
		assert.strictEqual(result2.templateData.canPostAnonymously, false);
		
		const result3 = await anonymous.filterComposerBuild(noTemplate);
		assert.deepStrictEqual(result3, noTemplate);
	});
});
