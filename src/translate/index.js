
/* eslint-disable strict */
//var request = require('request');

const translatorApi = module.exports;

translatorApi.translate = function (postData) {
	console.log('[TRANSLATE API DEBUG] translate called with:', { 
		content: postData?.content ? postData.content.substring(0, 100) : 'no content',
		hasContent: !!postData?.content,
		keys: Object.keys(postData || {})
	});
	const result = ['is_english', postData];
	console.log('[TRANSLATE API DEBUG] translate returning:', { isEnglish: result[0], hasTranslated: !!result[1] });
	return result;
};

// translatorApi.translate = async function (postData) {
//  Edit the translator URL below
//  const TRANSLATOR_API = "TODO"
//  const response = await fetch(TRANSLATOR_API+'/?content='+postData.content);
//  const data = await response.json();
//  return ['is_english','translated_content'];
// };
