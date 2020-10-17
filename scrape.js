var waterfall = require('async-waterfall');

var database = require('./database');
var Podcast = require('./models/podcast');

Podcast.find({}, function(err, podcasts){
    waterfall(podcasts.map(function(podcast){
        return function(cb){
		console.log("Polling: " + podcast.name + "(" + podcast.feed + ")");

		podcast.parse(function(feed){
			console.log(podcast);
			cb();
	        });
	};
    }), function(){
	console.log("DONE!");
    	process.exit(0);
    });
});
