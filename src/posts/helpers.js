'use strict';

const user = require('../user');
const topics = require('../topics');
const posts = require('./index');
const privileges = require('../privileges');

async function buildReqObject (caller) {
	const req = {
		uid: caller.uid,
		user: await user.getUserData(caller.uid),
		ip: '127.0.0.1', // Default for tests
	};
	return req;
}

async function doTopicAction (action, caller, data) {
	const canEdit = await privileges.topics.canEdit(data.tid, caller.uid);
	if (!canEdit.flag) {
		throw new Error('[[error:no-privileges]]');
	}

	const result = await topics[action](data.tid, caller.uid);
	return result;
}

async function postCommand (caller, command, eventName, notificationText, data) {
	const canRead = await privileges.posts.can('topics:read', data.pid, caller.uid);
	if (!canRead) {
		throw new Error('[[error:no-privileges]]');
	}

	const result = await posts[command](data.pid, caller.uid);

	// Emit socket event if needed
	if (eventName && result) {
		// This would normally emit to socket.io, simplified for testing
	}

	return result;
}

module.exports = {
	buildReqObject,
	doTopicAction,
	postCommand,
};
