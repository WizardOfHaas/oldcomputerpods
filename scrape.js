var database = require('./database');
var Podcast = require('./models/podcast');

Podcast.find({}, function(err, podcasts){
    podcasts.forEach(function(podcast){
        console.log("Polling: " + podcast.name + "(" + podcast.feed + ")");

	    podcast.parse(function(feed){
    		console.log(podcast);
        });
    });
});
