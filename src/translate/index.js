
/* eslint-disable strict */
//var request = require('request');

const translatorApi = module.exports;

const TRANSLATOR_HOST = process.env.TRANSLATOR_URL || 'http://host.docker.internal:5000';

translatorApi.translate = async function (postData) {
	const payload = {
		content: postData?.content || '',
	};
	console.log('[TRANSLATE API DEBUG] translate called with:', {
		url: `${TRANSLATOR_HOST}/translate`,
		keys: Object.keys(postData || {}),
		contentPreview: payload.content.substring(0, 100),
	});

	try {
		const response = await fetch(`${TRANSLATOR_HOST}/translate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(`Translator responded with status ${response.status}`);
		}

		const data = await response.json();
		console.log('[TRANSLATE API DEBUG] translate success:', {
			isEnglish: data?.isEnglish,
			translatedPreview: typeof data?.translatedContent === 'string' ? data.translatedContent.substring(0, 100) : '[non-string value]',
		});

		return [
			data?.isEnglish ?? 'is_english',
			data?.translatedContent ?? payload.content,
		];
	} catch (err) {
		console.error('[TRANSLATE API DEBUG] translate FAILED:', err);
		return ['is_english', payload.content];
	}
};
