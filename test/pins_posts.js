'use strict';

const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Post Pin/Unpin Functionality', () => {
	let pins;
	let stubs;

	beforeEach(() => {
		stubs = {
			db: {
				getSortedSetRange: sinon.stub(),
				getSetMembers: sinon.stub().resolves([]),
				setAdd: sinon.stub().resolves(),
				setRemove: sinon.stub().resolves(),
			},
			user: {
				isAdministrator: sinon.stub().resolves(false),
				isModerator: sinon.stub().resolves(false),
			},
			privileges: {
				users: { isAdministrator: sinon.stub().resolves(false) },
				topics: {
					can: sinon.stub().resolves(true),
					isModeratorOfTopic: sinon.stub().resolves(false),
				},
			},
			groups: { isMember: sinon.stub().resolves(false) },
			posts: {
				getPostFields: sinon
					.stub()
					.resolves({ pid: '123', tid: '456', pinned: '0' }),
				setPostField: sinon.stub().resolves(),
				getPostData: sinon.stub().resolves({ pid: '123', pinned: 1 }),
				getPostsFields: sinon.stub().resolves([{ pid: '123', pinned: '1' }]),
				getPostsData: sinon.stub().resolves([{ pid: '123', content: 'test' }]),
				getPostField: sinon.stub().resolves('456'),
			},
		};

		pins = proxyquire('../src/user/pins', {
			'../database': stubs.db,
			'./index': stubs.user,
			'../privileges': stubs.privileges,
			'../groups': stubs.groups,
			'../posts': stubs.posts,
		});
	});

	afterEach(() => sinon.restore());

	it('should allow admin to pin/unpin posts', async () => {
		stubs.user.isAdministrator.resolves(true);

		// Test pin
		const pinResult = await pins.pinPost('123', 1);
		assert(stubs.posts.setPostField.calledWith('123', 'pinned', 1));
		assert.strictEqual(pinResult.pid, '123');

		// Test unpin
		stubs.posts.getPostFields.resolves({ pid: '123', tid: '456', pinned: '1' });
		const unpinResult = await pins.unpinPost('123', 1);
		assert(stubs.posts.setPostField.calledWith('123', 'pinned', 0));
		assert.strictEqual(unpinResult.pid, '123');
	});

	it('should reject non-privileged users', async () => {
		await assert.rejects(pins.pinPost('123', 2), /no-privileges/);
		await assert.rejects(pins.unpinPost('123', 2), /no-privileges/);
	});

	it('should allow moderators in their topics', async () => {
		stubs.user.isModerator.resolves(true);
		stubs.privileges.topics.isModeratorOfTopic.resolves(true);

		const result = await pins.pinPost('123', 3);
		assert(stubs.posts.setPostField.calledWith('123', 'pinned', 1));
	});

	it('should handle edge cases', async () => {
		stubs.user.isAdministrator.resolves(true);

		// Already pinned
		stubs.posts.getPostFields.resolves({ pid: '123', tid: '456', pinned: '1' });
		await assert.rejects(pins.pinPost('123', 1), /already-pinned/);

		// Not pinned
		stubs.posts.getPostFields.resolves({ pid: '123', tid: '456', pinned: '0' });
		await assert.rejects(pins.unpinPost('123', 1), /not-pinned/);

		// Non-existent post
		stubs.posts.getPostFields.resolves({ pid: null });
		await assert.rejects(pins.pinPost('999', 1), /no-post/);
	});

	it('should get pinned posts for topics', async () => {
		stubs.db.getSortedSetRange.resolves(['123', '124', '125']);

		const result = await pins.getPinnedPosts('456', 1);
		assert(Array.isArray(result));
		assert(
			stubs.posts.getPostsFields.calledWith(
				['123', '124', '125'],
				['pid', 'pinned']
			)
		);

		// Empty topic
		stubs.db.getSortedSetRange.resolves([]);
		const emptyResult = await pins.getPinnedPosts('456', 1);
		assert.deepStrictEqual(emptyResult, []);
	});
});
