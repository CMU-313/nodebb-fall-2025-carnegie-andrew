'use strict';

// Use this in client:
const currentUserSlug = (app && app.user && app.user.userslug) ? app.user.userslug : 'unknown';
define('quickreply', [
	'components', 'autocomplete', 'api',
	'alerts', 'uploadHelpers', 'mousetrap', 'storage', 'hooks',
], function (
	components, autocomplete, api,
	alerts, uploadHelpers, mousetrap, storage, hooks
) {
	const QuickReply = {
		_autocomplete: null,
	};

	QuickReply.init = function () {
		const element = components.get('topic/quickreply/text');
		const qrDraftId = `qr:draft:tid:${ajaxify.data.tid}`;
		const data = {
			element,
			strategies: [],
			options: {
				style: {
					'z-index': 100,
				},
			},
		};

		// === Anonymous state wiring ===
		const $anonToggle = $('#qr-anon-toggle').length ?
			$('#qr-anon-toggle') :
			components.get('topic/quickreply/anonymous/toggle');
		const $anonHidden = $('[component="topic/quickreply/anonymous"]');

		// single source of truth during this page view
		let isAnonymous = !!($anonToggle && $anonToggle.prop && $anonToggle.prop('checked'));

		// keep hidden input in sync (for any form posts that read it)
		if ($anonHidden && $anonHidden.length) {
			$anonHidden.val(isAnonymous ? '1' : '0');
		}

		// helper to show a small toast
		function toastMode (state) {
			const msg = state ?
				'Anonymous mode ON — replies will post as Anonymous.' :
				'Anonymous mode OFF — replies will post as yourself.';
			alerts.alert({
				type: 'info',
				title: 'Posting mode changed',
				message: msg,
				timeout: 2500,
			});
		}

		// announce initial state (optional; comment out if you don’t want it)
		toastMode(isAnonymous);

		// when user flips the checkbox, update state + hidden + toast
		if ($anonToggle && $anonToggle.length) {
			$anonToggle.on('change', function () {
				isAnonymous = !!$(this).prop('checked');
				if ($anonHidden && $anonHidden.length) {
					$anonHidden.val(isAnonymous ? '1' : '0');
				}
				toastMode(isAnonymous);
			});
		}

		destroyAutoComplete();
		$(window).one('action:ajaxify.start', () => {
			destroyAutoComplete();
		});
		$(window).trigger('composer:autocomplete:init', data);
		QuickReply._autocomplete = autocomplete.setup(data);

		mousetrap.bind('ctrl+return', (e) => {
			if (e.target === element.get(0)) {
				components.get('topic/quickreply/button').get(0).click();
			}
		});

		uploadHelpers.init({
			uploadBtnEl: $('[component="topic/quickreply/upload/button"]'),
			dragDropAreaEl: $('[component="topic/quickreply/container"] .quickreply-message'),
			pasteEl: element,
			uploadFormEl: $('[component="topic/quickreply/upload"]'),
			inputEl: element,
			route: '/api/post/upload',
			callback: function (uploads) {
				let text = element.val();
				uploads.forEach((upload) => {
					text = text + (text ? '\n' : '') + (upload.isImage ? '!' : '') + `[${upload.filename}](${upload.url})`;
				});
				element.val(text);
			},
		});

		let ready = true;
		components.get('topic/quickreply/button').on('click', function (e) {
			e.preventDefault();
			if (!ready) {
				return;
			}

			const replyMsg = components.get('topic/quickreply/text').val();

			// === NEW: determine anonymous toggle state ===
			const anonymousNow = (function () {
				// prefer live checkbox
				const $anonToggle = $('#qr-anon-toggle');
				if ($anonToggle && $anonToggle.length && $anonToggle.prop) {
					return !!$anonToggle.prop('checked');
				}
				// fallback to hidden input if present
				const $anonHidden = $('[component="topic/quickreply/anonymous"]');
				if ($anonHidden && $anonHidden.length) {
					const v = $anonHidden.val();
					return v === '1' || v === 1 || v === true || v === 'true';
				}
				return false;
			})();

			// Build reply data with anonymous flag
			const replyData = {
				tid: ajaxify.data.tid,
				handle: undefined,
				content: replyMsg,
				anonymous: anonymousNow,
			};

			// Debug
			console.log('quickreply submit', { user: currentUserSlug, replyData });

			const replyLen = replyMsg.length;

			// console.log('posting with ' + 'user ' + user.slug + replyData + ']]');
			if (replyLen < parseInt(config.minimumPostLength, 10)) {
				return alerts.error('[[error:content-too-short, ' + config.minimumPostLength + ']]');
			} else if (replyLen > parseInt(config.maximumPostLength, 10)) {
				return alerts.error('[[error:content-too-long, ' + config.maximumPostLength + ']]');
			}
			// If the anonymous toggle is ON, do a frontend-only confirmation first
			// (no backend call). This satisfies STEP 1: confirm UI flow without DB change.
			if (replyData.anonymous) {
				alerts.alert({
					type: 'success',
					title: '[[global:alert.success]]',
					message: 'anonymous posting: ' + (app && app.user && app.user.userslug ? app.user.userslug : 'unknown') + ' posted anonymously',
					timeout: 3000,
				});

				// Clear the draft and textarea as if we've handled the reply locally.
				components.get('topic/quickreply/text').val('');
				storage.removeItem(qrDraftId);
				if (QuickReply._autocomplete) {
					QuickReply._autocomplete.hide();
				}
				// Fire the same success hook so other parts of the UI can respond.
				hooks.fire('action:quickreply.success', { data: { anonymous: true, frontendOnly: true } });

				return;
			}

			ready = false;
			api.post(`/topics/${ajaxify.data.tid}`, replyData, function (err, data) {
				ready = true;
				if (err) {
					return alerts.error(err);
				}
				if (data && data.queued) {
					alerts.alert({
						type: 'success',
						title: '[[global:alert.success]]',
						message: data.message,
						timeout: 10000,
						clickfn: function () {
							ajaxify.go(`/post-queue/${data.id}`);
						},
					});
				}

				components.get('topic/quickreply/text').val('');
				storage.removeItem(qrDraftId);
				QuickReply._autocomplete.hide();
				hooks.fire('action:quickreply.success', { data });
			});
		});

		const draft = storage.getItem(qrDraftId);
		if (draft) {
			element.val(draft);
		}

		element.on('keyup', utils.debounce(function () {
			const text = element.val();
			if (text) {
				storage.setItem(qrDraftId, text);
			} else {
				storage.removeItem(qrDraftId);
			}
		}, 1000));

		components.get('topic/quickreply/expand').on('click', (e) => {
			e.preventDefault();
			storage.removeItem(qrDraftId);
			const textEl = components.get('topic/quickreply/text');
			hooks.fire('action:composer.post.new', {
				tid: ajaxify.data.tid,
				title: ajaxify.data.titleRaw,
				body: textEl.val(),
			});
			textEl.val('');
		});
	};

	function destroyAutoComplete () {
		if (QuickReply._autocomplete) {
			QuickReply._autocomplete.destroy();
			QuickReply._autocomplete = null;
		}
	}

	return QuickReply;
});
