'use strict';

const db = require('../database');
const meta = require('../meta');
const topics = require('../topics');
const Anonymous = module.exports;

// Anonymous user ID
Anonymous.ANONYMOUS_UID = 0;

//Check if anonymous posting is enabled
Anonymous.isEnabled = function () {
	return meta.config.allowAnonymousPosts === 1;
};

/**
 * Create anonymous topic wrapper
 * @param {Object} data - Topic data
 * @param {number} data.uid - Original user ID
 * @param {boolean} data.anonymous - Whether to post anonymously
 * @param {string} data.cid - Category ID
 * @param {string} data.title - Topic title
 * @param {string} data.content - Topic content
 * @param {Array} data.tags - Topic tags
 * @returns {Object} Topic data
 */
Anonymous.createTopic = async function (data) {
	// Store the original uid and use anonymous uid for posting
	const originalUid = data.uid;
	const anonymousData = { ...data };
	if (data.anonymous) {
		anonymousData.uid = Anonymous.ANONYMOUS_UID;
		anonymousData.handle = await Anonymous.generateAnonymousHandle(originalUid);
		// Store mapping for moderation purposes
		await Anonymous.storeAnonymousMapping(originalUid, anonymousData);
	}
	const result = await topics.post(anonymousData);
	if (data.anonymous) {
		// Store the mapping between the post and original user for moderation
		await db.setObject(`post:${result.postData.pid}:anonymous`, {
			originalUid: originalUid,
			timestamp: Date.now(),
		});
	}
	return result;
};

/**
 * Create anonymous reply wrapper
 * @param {Object} data - Reply data
 * @param {number} data.uid - Original user ID
 * @param {boolean} data.anonymous - Whether to post anonymously
 * @param {string} data.tid - Topic ID
 * @param {string} data.content - Reply content
 * @returns {Object} Post data
 */
Anonymous.createReply = async function (data) {
	// Store the original uid and use anonymous uid for posting
	const originalUid = data.uid;
	const anonymousData = { ...data };
	if (data.anonymous) {
		anonymousData.uid = Anonymous.ANONYMOUS_UID;
		anonymousData.handle = await Anonymous.generateAnonymousHandle(originalUid);
	}
	const result = await topics.reply(anonymousData);
	if (data.anonymous) {
		await db.setObject(`post:${result.pid}:anonymous`, {
			originalUid: originalUid,
			timestamp: Date.now(),
		});
	}
	return result;
};

Anonymous.generateAnonymousHandle = async function (uid) {
	// Generate a simple deterministic anonymous handle based on user ID
	const hash = require('crypto').createHash('md5').update(`${uid}-anonymous`).digest('hex');
	return `Anonymous_${hash.substring(0, 8)}`;
};

Anonymous.getOriginalUid = async function (pid) {
	const data = await db.getObject(`post:${pid}:anonymous`);
	return data ? parseInt(data.originalUid, 10) : null;
};

Anonymous.storeAnonymousMapping = async function (originalUid, postData) {
	const timestamp = Date.now();
	await db.sortedSetAdd(
		`uid:${originalUid}:anonymous:posts`,
		timestamp,
		JSON.stringify({
			uid: postData.uid,
			handle: postData.handle,
			timestamp: timestamp,
		}),
	);
};

Anonymous.canPostAnonymously = async function (uid, cid) {
	// Basic user validation - allow most users
	if (parseInt(uid, 10) <= 0) {
		return false;
	}

	// Simplified privilege check
	const privileges = require('../privileges');
	const canPost = await privileges.categories.can('topics:create', cid, uid);
	return canPost;
};

Anonymous.getAnonymousPostsByUser = async function (uid) {
	const posts = await db.getSortedSetRevRange(`uid:${uid}:anonymous:posts`, 0, -1);
	return posts.map(post => JSON.parse(post));
};

Anonymous.filterComposerBuild = async function (data) {
	if (data.templateData) {
		data.templateData.showAnonymousOption = Anonymous.isEnabled();
		if (data.req.uid) {
			data.templateData.canPostAnonymously = await Anonymous.canPostAnonymously(
				data.req.uid,
				data.req.query.cid,
			);
		} else {
			data.templateData.canPostAnonymously = false;
		}
	}
	return data;
};
