/* eslint-env mocha */
'use strict';

const assert = require('assert');
const sinon = require('sinon');

// Require the route module so we can grab the middleware it exposes
const usersRoutes = require('../../src/routes/user');
const nconf = require('nconf');

describe('anonymous profile route guard', () => {
	let getStub;

	before(() => {
		getStub = sinon.stub(nconf, 'get').callsFake((key) => {
			if (key === 'relative_path') return '';
			return undefined;
		});
	});

	after(() => {
		getStub.restore();
	});

	function mkRes() {
		return {
			_redirectedTo: null,
			redirect(path) {
				this._redirectedTo = path;
			},
		};
	}

	it('redirects when userslug === anonymous', (done) => {
		const req = {
			params: { userslug: 'anonymous' },
			flash: () => {}, // noop
		};
		const res = mkRes();

		usersRoutes._blockAnonymousProfile(req, res, () => {
			done(new Error('next() should NOT be called for anonymous'));
		});

		assert.strictEqual(res._redirectedTo, '/', 'should redirect to home');
		done();
	});

	it('redirects when userslug === guest', (done) => {
		const req = {
			params: { userslug: 'guest' },
			flash: () => {},
		};
		const res = mkRes();

		usersRoutes._blockAnonymousProfile(req, res, () => {
			done(new Error('next() should NOT be called for guest'));
		});

		assert.strictEqual(res._redirectedTo, '/', 'should redirect to home');
		done();
	});

	it('calls next() for normal users', (done) => {
		const req = { params: { userslug: 'alice' } };
		const res = mkRes();

		usersRoutes._blockAnonymousProfile(req, res, () => done());
	});
});
