'use strict';

const assert = require('assert');
const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const posts = require('../src/posts');
const user = require('../src/user');
const categories = require('../src/categories');
const apiPosts = require('../src/api/posts');

describe('Vote Differentiation', () => {
	let voterUid;
	let voteeUid;
	let downvoterUid;
	let postData;
	let topicData;
	let cid;

	before(async () => {
		voterUid = await user.create({ username: 'vote-differ-upvoter' });
		downvoterUid = await user.create({ username: 'vote-differ-downvoter' });
		voteeUid = await user.create({ username: 'vote-differ-votee' });

		({ cid } = await categories.create({
			name: 'Vote Differentiation Test Category',
			description: 'Test category for vote differentiation',
		}));

		({ topicData, postData } = await topics.post({
			uid: voteeUid,
			cid: cid,
			title: 'Vote Differentiation Test Topic',
			content: 'Test content for vote differentiation',
		}));
	});

	after(async () => {
		// Clean up test data
		await topics.purge(topicData.tid, voterUid);
		await categories.purge(cid, voterUid);
	});

	it('should track upvotes and downvotes separately', async () => {
		// Upvote the post
		const upvoteResult = await apiPosts.upvote(
			{ uid: voterUid },
			{ pid: postData.pid, room_id: `topic_${topicData.tid}` }
		);

		assert.strictEqual(upvoteResult.post.upvotes, 1);
		assert.strictEqual(upvoteResult.post.downvotes, 0);
		assert.strictEqual(upvoteResult.post.votes, 1);

		// Downvote the post from a different user
		const downvoteResult = await apiPosts.downvote(
			{ uid: downvoterUid },
			{ pid: postData.pid, room_id: `topic_${topicData.tid}` }
		);

		assert.strictEqual(downvoteResult.post.upvotes, 1);
		assert.strictEqual(downvoteResult.post.downvotes, 1);
		assert.strictEqual(downvoteResult.post.votes, 0);
	});

	it('should return separate upvote and downvote counts in post data', async () => {
		const postFields = await posts.getPostFields(postData.pid, ['upvotes', 'downvotes', 'votes']);

		assert.strictEqual(postFields.upvotes, 1);
		assert.strictEqual(postFields.downvotes, 1);
		assert.strictEqual(postFields.votes, 0);
	});

	it('should update counts when switching from upvote to downvote', async () => {
		// Create new post for this test
		const newPost = await topics.reply({
			tid: topicData.tid,
			uid: voteeUid,
			content: 'Another test post',
		});

		// First upvote
		await apiPosts.upvote(
			{ uid: voterUid },
			{ pid: newPost.pid, room_id: `topic_${topicData.tid}` }
		);

		const fields = await posts.getPostFields(newPost.pid, ['upvotes', 'downvotes', 'votes']);
		assert.strictEqual(fields.upvotes, 1);
		assert.strictEqual(fields.downvotes, 0);
		assert.strictEqual(fields.votes, 1);

		// Switch to downvote
		const downvoteResult = await apiPosts.downvote(
			{ uid: voterUid },
			{ pid: newPost.pid, room_id: `topic_${topicData.tid}` }
		);

		assert.strictEqual(downvoteResult.post.upvotes, 0);
		assert.strictEqual(downvoteResult.post.downvotes, 1);
		assert.strictEqual(downvoteResult.post.votes, -1);
	});

	it('should correctly handle unvoting', async () => {
		// Create new post for this test
		const newPost = await topics.reply({
			tid: topicData.tid,
			uid: voteeUid,
			content: 'Unvote test post',
		});

		// Upvote
		await apiPosts.upvote(
			{ uid: voterUid },
			{ pid: newPost.pid, room_id: `topic_${topicData.tid}` }
		);

		// Unvote
		const unvoteResult = await apiPosts.unvote(
			{ uid: voterUid },
			{ pid: newPost.pid, room_id: `topic_${topicData.tid}` }
		);

		assert.strictEqual(unvoteResult.post.upvotes, 0);
		assert.strictEqual(unvoteResult.post.downvotes, 0);
		assert.strictEqual(unvoteResult.post.votes, 0);
	});

	it('should handle multiple voters correctly', async () => {
		// Create new post for this test
		const newPost = await topics.reply({
			tid: topicData.tid,
			uid: voteeUid,
			content: 'Multiple voters test post',
		});

		const voter1 = await user.create({ username: 'multi-voter-1' });
		const voter2 = await user.create({ username: 'multi-voter-2' });
		const voter3 = await user.create({ username: 'multi-voter-3' });

		// 2 upvotes, 1 downvote
		await apiPosts.upvote({ uid: voter1 }, { pid: newPost.pid, room_id: `topic_${topicData.tid}` });
		await apiPosts.upvote({ uid: voter2 }, { pid: newPost.pid, room_id: `topic_${topicData.tid}` });
		await apiPosts.downvote({ uid: voter3 }, { pid: newPost.pid, room_id: `topic_${topicData.tid}` });

		const fields = await posts.getPostFields(newPost.pid, ['upvotes', 'downvotes', 'votes']);

		assert.strictEqual(fields.upvotes, 2);
		assert.strictEqual(fields.downvotes, 1);
		assert.strictEqual(fields.votes, 1);
	});
});

