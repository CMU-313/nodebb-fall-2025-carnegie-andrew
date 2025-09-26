'use strict';

/**
 * Per-user pinned thread (topic) storage.
 * - Stores a set of topic IDs under key: user:<uid>:pinnedTids
 * - Enforces MAX_PINS
 * - Only Admins or members of INSTRUCTOR_GROUP may pin/unpin
 */

const db = require('../database');
const groups = require('../groups');
const privileges = require('../privileges');

const MAX_PINS = 5;
const INSTRUCTOR_GROUP = 'instructors'; // change if your course uses a different name

function keyFor(uid) {
	return `user:${uid}:pinnedTids`;
}

async function canPin(uid) {
	if (!(parseInt(uid, 10) > 0)) {
		return false;
	}
	const [isAdmin, isInstructor] = await Promise.all([
		privileges.users.isAdministrator(uid),
		groups.isMember(uid, INSTRUCTOR_GROUP),
	]);
	return Boolean(isAdmin || isInstructor);
}

async function getPinnedTids(uid) {
	const tids = await db.getSetMembers(keyFor(uid));
	return (tids || [])
		.map(t => Number(t))
		.filter(n => Number.isFinite(n));
}

async function addPinnedTid(uid, tid) {
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

async function removePinnedTid(uid, tid) {
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

module.exports = {
	MAX_PINS,
	keyFor,
	canPin,
	getPinnedTids,
	addPinnedTid,
	removePinnedTid,
};