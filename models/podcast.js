var mongoose = require('mongoose');
var Parser = require('rss-parser');
var axios = require('axios');
const getColors = require('get-image-colors');
var waterfall = require('async-waterfall');

var Episode = require('./episode');

var podcastSchema = new mongoose.Schema({
	name: {type: String, unique: true, required: true},
	feed: {type: String, unique: true, required: true},
	image: String,
	description: String,
	pubDate: String,
	author: String,
	contact: String,
	categories: mongoose.Schema.Types.Mixed,
	options: mongoose.Schema.Types.Mixed
});

podcastSchema.methods.parse = function(cb){
	var self = this;

	var parser = new Parser();

	parser.parseURL(self.feed, function(err, feed){
		if(err){
			console.log(err);
		}else{
            if(feed.image){
                self.image = feed.image.url;
            }else if(feed.itunes){
                self.image = feed.itunes.image;
            }

			self.description = feed.description;
			self.pubDate = feed.pubDate;
			self.author = feed.itunes ? feed.itunes.author : "";
			self.contact = feed.itunes ? feed.itunes.owner.email : "";
			self.categories = feed.itunes ? feed.itunes.categories : [];

            if(!self.options){
                self.options = {};
            }

            self.options.website = feed.image ? feed.image.link : feed.link;

			feed.items.forEach(function(item, i){
				if(item.enclosure && item.enclosure.type && item.enclosure.type.match("audio")){
                    Episode.find({guid: item.guid}).then(function(episode){
                        var tags = [];
                        
                        if(item.itunes && item.itunes.keywords){
                            if(typeof item.itunes.keywords === "array"){
                                tags = item.itunes.keywords.filter(function(d){
                                    return d.length > 2;
                                });
                            }else{
                                tags = item.itunes.keywords.split(",").filter(function(d){
                                    return d.length > 2;
                                });
                            }
                        }
                    
					    var ep = {
                            title: item.title.replace(/.*Episode [0-9\.]*\s?[\-\:]\s?/, ""),
                            fullTitle: item.title,
					    	podcast: self._id,
					    	link: item.link,
					    	pubDate: item.pubDate,
					    	media: item.enclosure.url,
					    	description: item.content,
					    	guid: item.guid,
					    	image: item.itunes && item.itunes.image ? item.itunes.image : self.image,
					    	episodeNumber: item.itunes && item.itunes.episode ? item.itunes.episode : null,
                            duration: item.itunes ? item.itunes.duration : "",
                            tags: tags,
					    	options: episode && episode.options ? episode.options : {}
                        };

                        ep.options.website = item.link;

                        if(episode && episode.options && episode.options.trackId){
                            updateEp(ep);
                        }else{
					        axios.get("https://itunes.apple.com/search?term=" + ep.title.replace(/[\s\,\-\&]+/g, "+") + "&entity=podcastEpisode").then(function(resp){
					    	    if(resp.data.results.length > 0 && resp.data.results[0].trackName == ep.title && resp.data.results[0].collectionName == self.name){
                                    ep.options.appleUrl = resp.data.results[0].collectionViewUrl;
                                    ep.options.trackId = resp.data.results[0].trackId;

                                    //https://plinkhq.com/i/1459202600/e/1000493569838?to=googlepod
                                    axios.get("https://plinkhq.com/i/" + self.options.appleId + "/e/" + ep.options.trackId  + "?to=googlepod").then(function(resp){
                                        ep.options.googleUrl = resp.request.res.responseUrl;

                                        updateEp(ep);
                                    }).catch(function(err){
                                        console.log("Plinq had an issue: " + err.response.statusText);

                                        updateEp(ep);
                                    });
    					    	}else{
                                    updateEp(ep);
                                }
	    				    }).catch(function(err){
                                //console.log("Failed: " + err.request.path);
                                updateEp(ep);
                            });
                        }
                    });
				}
            });
            
            waterfall([
                function(next){ //Get Apple collection ID and URL
                    console.log("https://itunes.apple.com/search?term=" + self.name.replace(/\s+/g, "+") + "&entity=podcast");
                    axios.get("https://itunes.apple.com/search?term=" + self.name.replace(/\s+/g, "+") + "&entity=podcast").then(function(resp){
                        self.options.appleId = resp.data.results[0].collectionId;
                        self.options.appleUrl= resp.data.results[0].collectionViewUrl;

                        next();
                    }).catch(function(err){
                        console.log("Failed to get apple collection ID");
                        next();
                    });
                },
                function(next){ //Get Google Podcasts URL
                    axios.get("https://plinkhq.com/i/" + self.options.appleId + "?to=googlepod").then(function(resp){
                        self.options.googleUrl = resp.request.res.responseUrl;

                        next();
                    }).catch(function(err){
                        next();
                    });
                },
                function(next){ //Get Spotify URL
                    axios.get("https://plinkhq.com/i/" + self.options.appleId + "?to=spotify").then(function(resp){
                        self.options.spotifyUrl = resp.request.res.responseUrl;

                        next();
                    }).catch(function(err){
                        next();
                    });
                },
                function(next){ //Sample image colors
                    getImageColors(self.image, function(colors){
                        self.options.colors = colors;

                        next();
                    });
                }
            ], function(err, res){
                self.markModified('options');

                self.save().then(function(){
                    if(cb){
                        cb(feed);
                    }
                });
            });

            /*
            //https://itunes.apple.com/search?term=Advent+Of+Computing&entity=podcast
            axios.get("https://itunes.apple.com/search?term=" + self.name.replace(/\s+/g, "+") + "&entity=podcast").then(function(resp){
                self.options.appleId = resp.data.results[0].collectionId;
                self.options.appleUrl= resp.data.results[0].collectionViewUrl;

                //https://plinkhq.com/i/appleID?to=googlepod
                //https://plinkhq.com/i/appleID?to=spotify
                //https://plinkhq.com/i/appleID?to=applepod

                getImageColors(self.image, function(colors){
                    self.options.colors = colors;
    
                    self.markModified('options');

                    self.save().then(function(){
                        if(cb){
                            cb(feed);
                        }
                    });
                });
            });
            */
		}
	})
}

function updateEp(ep, cb){
    Episode.findOneAndUpdate(
        {guid: ep.guid},
        ep,
        {new: true, upsert: true}
    ).then(function(d){
        console.log("Updates: " + ep.title);

        if(cb){
            cb(null, d);
        }
    }).catch(function(err){
        console.log("DB error: " + ep.title);
        console.log(err);

        if(cb){
            cb(err, null);
        }
    });
}

function getImageColors(url, cb){
    axios.get(url, {
        responseType: 'arraybuffer'
    }).then(function(resp){
        getColors(resp.data, resp.headers["content-type"]).then(function(colors){
            /*colors.sort(function(a, b){
                //return rgb2hsv(a._rgb)[0] - rgb2hsv(b._rgb)[0];

                return (3*256 - a._rgb[0] - a._rgb[1] - a._rgb[2]) - (3*256 - b._rgb[0] - b._rgb[1] - b._rgb[2]);
            });*/

            //Remove similar colors....
            colors = colors.filter(function(a, i){
                var similar = colors.filter(function(b, j){
                    if(i == j){
                        return false;
                    }else if(
                        Math.abs(a._rgb[0] - b._rgb[0]) < 10 &&
                        Math.abs(a._rgb[1] - b._rgb[1]) < 10 &&
                        Math.abs(a._rgb[2] - b._rgb[2]) < 10
                    ){
                        return true;
                    }else{
                        return false;
                    }
                });

                return similar.length == 0;
            });

            cb(colors);
        });
    }).catch(function(err){
        cb([]);
    });
}

function rgb2hsv(d){
    var r = d[0];
    var g = d[0];
    var b = d[0];

    let v=Math.max(r,g,b), n=v-Math.min(r,g,b);
    let h= n && ((v==r) ? (g-b)/n : ((v==g) ? 2+(b-r)/n : 4+(r-g)/n)); 
    return [60*(h<0?h+6:h), v&&n/v, v];
} 

module.exports = mongoose.model("Podcast", podcastSchema);
