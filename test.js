// test script
const event = {
    "Records": [ { "s3": { "bucket": { "name": "mybucket" }, "object": { "key": "test.json" } } } ]
};

const context = {};
const callback = function(err, data) {
	if (err) console.log(err);
	if (data) console.log(data);
    return;
};

const index = require('./index');
index.handler(event, context, callback);