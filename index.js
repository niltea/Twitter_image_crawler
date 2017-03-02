"use strict";

// currently hardcording...
const is_saveLocal = false;

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
// const fs = require('fs');

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

// fav iteretor
const processFav = (tweets) => {
	const _conf = config.get('twtr');
	const tweetsNum = tweets.length;
	if (tweetsNum <= 0) {
		if (watchdog) {
			postSlack(generateSlackPayload('watchdog: works fine.'));
		}
		console.log('no new tweet found.');
		return true;
	}
	tweets.forEach((tweet, i) => {
		// get meta
		const user = tweet.user;
		const screen_name = user.screen_name;
		const tweet_url = _conf.twitter_url + screen_name + '/status/' + tweet.id_str;

		// get media
		const extended_entities = tweet.extended_entities;
		const media = extended_entities ? extended_entities.media : null;
		// const media_arr = mediaGetter(media);

		const text = '@' + _conf.screen_name + 'でfavした画像だよー\n' + tweet_url;
		const payload = generateSlackPayload(text);

		// 画像があればsave
		// if(media_arr) { saveImages(media_arr, screen_name , is_nsfw, payload); }
	});
};

const fetchFav = () => {
	const endpoint = 'favorites/list.json';
	const params = config.get('twtr');
	params.count = 20;

	return new Promise((resolve, reject) => {
		twtr_client.get(endpoint , params, function(error, tweets, response){
			if (error) {
				reject('ERR on twitter');
				return false;
			}
			processFav(tweets);
			resolve('ok');
		});
	});
};

exports.handler = (event, context, callback) => {
	const payload = generateSlackPayload('hoge');
	fetchFav().then(ret => {
		console.log(ret);
	}).catch(err => {
		console.log(err);
	});
};

