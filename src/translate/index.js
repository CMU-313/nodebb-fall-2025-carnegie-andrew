"use strict";
const translatorApi = module.exports;

// translatorApi.translate = function (postData) {
// return ['is_english',postData];
// };

translatorApi.translate = async function (postData) {
	const TRANSLATOR_API = 'http://128.2.220.232:5000/';
	try {
		const response = await fetch(TRANSLATOR_API + '/?content=' + postData.content);
		const data = await response.json();
		return ['is_english', data.translated_content];
	} catch (error) {
		console.error(error);
		return ['is_english', postData.content];
	}
};

