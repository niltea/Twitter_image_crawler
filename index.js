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
// const twitter = require('twitter');
// const twtr_client = new twitter(credentials);
// const qs = require('querystring');
const request = require('request');
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
	return {set, get, list}
})();

// define config
config.set([
{
	key: 'twtr',
	value: {
		twitter_url: 'https://twitter.com/',
		targetID:   process.env.twtr_targetID,
		c_key:      process.env.twtr_consumer_key,
		c_secret:   process.env.twtr_consumer_secret,
		a_t_key:    process.env.twtr_access_token_key,
		a_t_secret: process.env.twtr_access_token_secret
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

// set AWS config
AWS.config.update({
	accessKeyId:     process.env.aws_accessKeyId,
	secretAccessKey: process.env.aws_targetID,
	region:          process.env.aws_consumer_key
});
const aws_s3 = new AWS.S3();

// slack payload generator
const generateSlackPayload = (text) => {
	const {icon_url, channel, username} = config.get('slack');
	return {icon_url, channel, username, text};
};
// post to Slack
const postSlack = (payload) => {
	const webhook_URL = config.get('slack').webhook_URL;
	const options = {
		uri: webhook_URL,
		headers: {
			'Content-Type':'application/json'
		},
		json: payload
	}
	request.post(options, (error, response, body) => {
		if (response.body === 'ok') {
			return 'success';
		} else {
			return 'error';
			console.log(error);
		}
	});
};

const payload = generateSlackPayload('hoge');
postSlack(payload);