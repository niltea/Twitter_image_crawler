"use strict";

// currently hardcording...
const is_saveLocal = true;
const imgPath = 'images/';

//set watchdog is true when 0:00-0:09 and 12:00-12:09
const watchdog = (() => {
	const date = new Date();
	const hour = date.getHours();
	const min = date.getMinutes();
	return ((hour === 0 || hour === 12) && (0 <= min || min >= 9)) ? true : false;
})();

// load modules
const AWS = require('aws-sdk');
const twitter = require('twitter');
// const qs = require('querystring');
// const request = require('request-promise');
const url = require('url');
const https = require('https');
const fs = require('fs');

// config setter
const config = (() => {
	const _conf = {};
	const _setter = _prop => {
		if (!_prop || typeof _prop !== 'object') return false;
		_conf[_prop.key] = _prop.value;
	};
	// public method
	const set = _prop => {
		if (!_prop || typeof _prop !== 'object') return false;
		if (_prop.constructor === Object) {
			_setter(_prop);
			return true;
		}
		_prop.forEach(_p => {
			_setter(_p);
			return true;
		});
		return true;
	};
	const get = _target => {
		if (!_conf[_target]) return null;
		return _conf[_target];
	};
	const list = () => {
		console.log(_conf);
		return true;
	};
	return {set:set, get:get, list:list};
})();

// define config
config.set([
{
	key: 'twtr',
	value: {
		twitter_url: 'https://twitter.com/',
		screen_name: process.env.twtr_targetID
	}
},
{
	key: 'slack',
	value: {
		webhook_URL: process.env.slack_webhook_URL,
		channel:     process.env.slack_channel || null,
		icon_url:    process.env.slack_icon_url || null,
		username:    process.env.slack_username || null
	}
}
]);

// set Twitter config
const twtr_client = new twitter({
	consumer_key:        process.env.twtr_consumer_key,
	consumer_secret:     process.env.twtr_consumer_secret,
	access_token_key:    process.env.twtr_access_token_key,
	access_token_secret: process.env.twtr_access_token_secret
});

// set AWS config
AWS.config.update({
	accessKeyId:     process.env.aws_accessKeyId,
	secretAccessKey: process.env.aws_secretAccessKey,
	region:          process.env.aws_region
});
const aws_s3 = new AWS.S3();

// slack payload generator
const generateSlackPayload = (text) => {
	const _c = config.get('slack');
	return {icon_url:_c.icon_url, channel:_c.channel, username:_c.username, text:text};
};
// post to Slack
const postSlack = (payload) => {
console.log(payload);return;
	const body = JSON.stringify(payload);
	const webhook_URL = config.get('slack').webhook_URL;
	const Sendoptions = url.parse(webhook_URL);
	Sendoptions.method = 'POST';
	Sendoptions.headers = {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(body),
	};
	return new Promise((resolve, reject) => {
		const postReq = https.request(Sendoptions, (res) => {
			const chunks = [];
			res.setEncoding('utf8');
			res.on('data', (chunk) => chunks.push(chunk));
			res.on('end', () => {
				if (res.statusCode == 200) {
					resolve('OK');
				} else {
					reject(res.statusCode);
				}
			});
			return;
		});
		postReq.write(body);
		postReq.end();
	});
};

const saveLocal = (fileMeta) => {
	// save local
	fs.mkdir(imgPath, (err) => {
		if (err && err.code !== 'EEXIST'){
			console.log('code: %s', err.code);
			console.log('err: %s', err);
			return false;
		}
		fs.mkdir(fileMeta.dest, (err) => {
			if (err && err.code !== 'EEXIST'){
				console.log('err_: %s', err_);
				return false;
			}
			fs.writeFileSync(fileMeta.dest + fileMeta.fileName, fileMeta.body, 'binary');
		});
	});
};
const saveS3 = (fileMeta) => {
	fileMeta.objectProp.Body = fileMeta.body;
	aws_s3.putObject(fileMeta.objectProp, (err, result) => {
		if (err) {
			console.log('========== err:S3 ==========');
			console.log(err);
			return false;
		} else {
			console.log('saved');
			return true;
		}
	});
};

const writeImage = (item) => {
	if(!item.fileMeta.body) {
		console.log('err: no body');
		return false;
	}
	if(is_saveLocal) {
		saveLocal(item.fileMeta);
	} else {
		saveS3(item.fileMeta);
	}
};

const setRequest = (media, screen_name) => {
	if (media.url === void 0) { return false; }
	// set fileName
	const dest = imgPath + screen_name + '/';
	const ext = media.url.match(/\.[a-zA-Z0-9]+$/)[0];
	const fileName = media.id + ext;
	let contentType = '';
	switch (ext) {
		case '.jpg': contentType = 'image/jpeg';  break;
		case '.gif': contentType = 'image/gif';   break;
		case '.png': contentType = 'image/png';   break;
		case '.bmp': contentType = 'image/x-bmp'; break;
		case '.mp4': contentType = 'video/mp4';   break;
	}

	const query = {
		url: media.url,
		method: 'GET',
		encoding: null,
		headers: { 'User-Agent': 'Twitter image crawler on node.js http://nilgiri-tea.net/' }
	};
	const fileMeta = {
		ext : ext,
		dest : dest,
		fileName : fileName,
		contentType : contentType,
		objectProp : {
			Bucket: 'niltea-twitter',
			Key  : dest + fileName,
			ContentType : contentType,
		}
	};
	return {query, fileMeta, postSlack: false};
};

const fetchImage = (item, isRetry) => {
	return new Promise((resolve, reject) => {
		if (!item) resolve('fetchImage: no image');

		const img_url = item.query.url;
		const query = url.parse(img_url);
		query.method = item.query.method;
		query.headers = {
			'Content-Type': item.fileMeta.contentType
		};

		const _req = https.request(query, (res) => {
			res.setEncoding('binary');
			let data = [];
			res.on('data', (chunk) => {data.push(new Buffer( chunk, 'binary' ))});
			res.on('end', () => {
				if (res.statusCode == 200) {
					item.fileMeta.body = Buffer.concat(data);
					writeImage(item);
					resolve('fetchImage: image Saved');
				} else {
					if (!isRetry) { fetchImage(item, true); }
					else {
						reject('fetchImage: fetch error ' + res.statusCode);
					}
				}
			});
		});
		_req.write('');
		_req.end();
	});
};

// tweet単位でarrayに格納されたid/urlから画像保存
const saveImages = (media_arr, screen_name, slackText) => {
	const mediaNum = media_arr.length;
	let done = 0;
	return new Promise((resolve, reject) => {
		if (mediaNum === 0) resolve('saveImages: no image');

		media_arr.forEach((media, i) => {
			const request = setRequest(media, screen_name);
			// 画像fetch
			fetchImage(request).then(() => {
				// 終了したらカウントアップ、全件終了したらSlack投稿&resolveする
				done += 1;
				console.log('saveImages - done: %s / total: %s', done, mediaNum);
				if (done >= mediaNum) {
					// postSlack(generateSlackPayload(slackText));
					resolve('saveImages: image Saved');
				}
			});
		});

	});
}

// select the highest bitrate video.
const videoSelector = media => {
	let hay = {};
	media.video_info.variants.forEach((item, i) => {
		if (item.content_type !== 'video/mp4') return;
		if (hay.bitrate === void 0 || hay.bitrate < item.bitrate) { hay = item; }
	});
	return hay.url;
};

// pop media
const mediaGetter = media => {
	let media_arr = [];
	media.forEach((item, i) => {
		const url = (item.type === 'video') ? videoSelector(item) : item.media_url_https;
		media_arr.push({id: item.id_str, url: url});
	});
	return media_arr;
};

// fav iteretor
const processFav = (tweets) => {
	const _conf = config.get('twtr');
	const tweetsNum = tweets.length;
	let done = 0;
	return new Promise((resolve, reject) => {
		if (tweetsNum <= 0) {
			if (watchdog) {
				postSlack(generateSlackPayload('watchdog: works fine.'));
			}
			resolve('no new tweet found.');
		}
		tweets.forEach((tweet, i) => {
			// get meta
			const user = tweet.user;
			const screen_name = user.screen_name;
			const tweet_url = _conf.twitter_url + screen_name + '/status/' + tweet.id_str;

			// get media
			const extended_entities = tweet.extended_entities;
			const slackText = '@' + _conf.screen_name + 'でfavした画像だよー\n' + tweet_url;
			// media_arr = [{id: media_id, url: url}, {}, ...];
			const media_arr = extended_entities ? mediaGetter(extended_entities.media) : null;

			// 画像save
			saveImages(media_arr, screen_name, slackText)
			.then(() => {
				// 終了したらカウントアップ、全件終了したらresolveする
				done += 1;
				console.log('done: %s / total: %s',done ,tweetsNum);
				if (done >= tweetsNum) {
					resolve('saveImages: finished');
				}
			});
		});
	});
};

const fetchFav = () => {
	const endpoint = 'favorites/list.json';
	const params = config.get('twtr');
	params.count = 1;

	return new Promise((resolve, reject) => {
		twtr_client.get(endpoint , params, function(error, tweets, response){
			if (error) {
				reject('ERR on twitter');
				return false;
			}
			processFav(tweets).then(() => {
				resolve('fetchFav: ok');
			});
		});
	});
};

exports.handler = (event, context, callback) => {
	const payload = generateSlackPayload('hoge');
	fetchFav().then(ret => { console.log(ret); }).catch(err => { console.log(err); });
	// saveImages(data, 'niltea', 'slackText').then(ret => { console.log(ret); }).catch(err => { console.log(err); });
};

