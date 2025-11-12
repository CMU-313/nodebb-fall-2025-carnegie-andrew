'use strict';

const factory = require('./translator.common');

define('translator', ['jquery', 'utils'], function (jQuery, utils) {
	function loadClient(language, namespace) {
		return new Promise(function (resolve, reject) {
			const url = [config.asset_base_url, 'language', language, namespace].join('/') + '.json?' + config['cache-buster'];
			console.log('[TRANSLATOR DEBUG] loadClient called:', { language, namespace, url, asset_base_url: config.asset_base_url, cache_buster: config['cache-buster'] });
			
			jQuery.getJSON(url, function (data) {
				console.log('[TRANSLATOR DEBUG] loadClient success:', { language, namespace, url, dataKeys: Object.keys(data || {}), dataSize: JSON.stringify(data || {}).length });
				const payload = {
					language: language,
					namespace: namespace,
					data: data,
				};
				require(['hooks'], function (hooks) {
					hooks.fire('action:translator.loadClient', payload);
					resolve(payload.promise ? Promise.resolve(payload.promise) : data);
				});
			}).fail(function (jqxhr, textStatus, error) {
				console.error('[TRANSLATOR DEBUG] loadClient FAILED:', { language, namespace, url, status: jqxhr.status, statusText: jqxhr.statusText, textStatus, error, responseText: jqxhr.responseText });
				reject(new Error(textStatus + ', ' + error));
			});
		});
	}
	const warn = function () { console.warn.apply(console, arguments); };
	return factory(utils, loadClient, warn);
});
