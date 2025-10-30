'use strict';

/**
 * User pinning functionality - handles both topics and posts
 *
 * Topic pins: users can bookmark important topics (stored in sets)
 * Post pins: mods can highlight key comments in discussions (stored as flags)
 */

const db = require('../database');
const groups = require('../groups');
const privileges = require('../privileges');

const MAX_PINS = 5;
const INSTRUCTOR_GROUP = 'instructors';

// Topic pinning stuff
function keyFor (uid) {
	return `user:${uid}:pinnedTids`;
}

async function canPin (uid) {
	if (!(parseInt(uid, 10) > 0)) {
		return false;
	}
	const [isAdmin, isInstructor] = await Promise.all([
		privileges.users.isAdministrator(uid),
		groups.isMember(uid, INSTRUCTOR_GROUP),
	]);
	return Boolean(isAdmin || isInstructor);
}

async function getPinnedTids (uid) {
	const tids = await db.getSetMembers(keyFor(uid));
	return (tids || [])
		.map(t => Number(t))
		.filter(n => Number.isFinite(n));
}

async function addPinnedTid (uid, tid) {
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
		// idempotent: already pinned
		return current;
	}
	if (current.length >= MAX_PINS) {
		const err = new Error(`Max pins (${MAX_PINS}) reached`);
		err.status = 400;
		throw err;
	}

	await db.setAdd(keyFor(uid), String(normalized));
	return getPinnedTids(uid);
}

async function removePinnedTid (uid, tid) {
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

// Post pinning stuff

async function canPinPosts (pid, uid) {
	const user = require('./index');
	const [isAdmin, isModerator, postData] = await Promise.all([
		user.isAdministrator(uid),
		user.isModerator(uid),
		getPostField(pid, 'tid'),
	]);

	if (isAdmin) {
		return true;
	}

	if (isModerator && postData) {
		const canModerate = await privileges.topics.isModeratorOfTopic(uid, postData);
		return canModerate;
	}

	return false;
}

async function pinPost (pid, uid) {
	const [canPin, postData] = await Promise.all([
		canPinPosts(pid, uid),
		getPostFields(pid, ['pid', 'tid', 'pinned']),
	]);

	if (!canPin) {
		throw new Error('[[error:no-privileges]]');
	}

	if (!postData.pid) {
		throw new Error('[[error:no-post]]');
	}

	if (parseInt(postData.pinned, 10) === 1) {
		throw new Error('[[error:post-already-pinned]]');
	}

	await setPostField(pid, 'pinned', 1);
	return await getPostData(pid);
}

async function unpinPost (pid, uid) {
	const [canPin, postData] = await Promise.all([
		canPinPosts(pid, uid),
		getPostFields(pid, ['pid', 'tid', 'pinned']),
	]);

	if (!canPin) {
		throw new Error('[[error:no-privileges]]');
	}

	if (!postData.pid) {
		throw new Error('[[error:no-post]]');
	}

	if (parseInt(postData.pinned, 10) !== 1) {
		throw new Error('[[error:post-not-pinned]]');
	}

	await setPostField(pid, 'pinned', 0);
	return await getPostData(pid);
}

async function getPinnedPosts (tid, uid) {
	const [canRead, pids] = await Promise.all([
		privileges.topics.can('topics:read', tid, uid),
		db.getSortedSetRange(`tid:${tid}:posts`, 0, -1),
	]);

	if (!canRead) {
		throw new Error('[[error:no-privileges]]');
	}

	if (!pids.length) {
		return [];
	}

	const postsData = await getPostsFields(pids, ['pid', 'pinned']);
	const pinnedPids = postsData
		.filter(post => parseInt(post.pinned, 10) === 1)
		.map(post => post.pid);

	if (!pinnedPids.length) {
		return [];
	}

	return await getPostsData(pinnedPids);
}

// Helper functions - these just wrap the posts module methods
async function getPostFields (pid, fields) {
	const posts = require('../posts');
	return await posts.getPostFields(pid, fields);
}

async function setPostField (pid, field, value) {
	const posts = require('../posts');
	return await posts.setPostField(pid, field, value);
}

async function getPostData (pid) {
	const posts = require('../posts');
	return await posts.getPostData(pid);
}

async function getPostsFields (pids, fields) {
	const posts = require('../posts');
	return await posts.getPostsFields(pids, fields);
}

async function getPostsData (pids) {
	const posts = require('../posts');
	return await posts.getPostsData(pids);
}

async function getPostField (pid, field) {
	const posts = require('../posts');
	return await posts.getPostField(pid, field);
}

module.exports = {
	// topic stuff
	MAX_PINS,
	keyFor,
	canPin,
	getPinnedTids,
	addPinnedTid,
	removePinnedTid,

	// post stuff
	canPinPosts,
	pinPost,
	unpinPost,
	getPinnedPosts,
};
