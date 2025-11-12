
/* eslint-disable strict */
//var request = require('request');

const translatorApi = module.exports;

const DEFAULT_TRANSLATOR_URL = process.env.TRANSLATOR_URL || 'http://128.2.220.232:5000';

translatorApi.translate = async function (postData) {
	const content = postData?.content || '';
	const encodedContent = encodeURIComponent(content);
	const requestUrl = `${DEFAULT_TRANSLATOR_URL}/?content=${encodedContent}`;

	console.log('[TRANSLATE API DEBUG] translate called with:', {
		requestUrl,
		keys: Object.keys(postData || {}),
		contentPreview: content.substring(0, 100),
	});

	try {
		const response = await fetch(requestUrl);
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
			data?.translatedContent ?? content,
		];
	} catch (err) {
		console.error('[TRANSLATE API DEBUG] translate FAILED:', err);
		return ['is_english', content];
	}
};
