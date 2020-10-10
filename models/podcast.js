var mongoose = require('mongoose');
var Parser = require('rss-parser');
var axios = require('axios');
const getColors = require('get-image-colors');

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
        //console.log(feed);

		if(err){
			console.log(err);
		}else{
			self.image = feed.image ? feed.image.url : feed.itunes.image;
			self.description = feed.description;
			self.pubDate = feed.pubDate;
			self.author = feed.itunes.author;
			self.contact = feed.itunes.owner.email;
			self.categories = feed.itunes.categories;

            if(!self.options){
                self.options = {};
            }

            self.options.website = feed.image ? feed.image.link : feed.link;

			feed.items.forEach(function(item, i){
				if(item.enclosure && item.enclosure.type && item.enclosure.type.match("audio")){
                    Episode.find({guid: item.guid}).then(function(episode){
                        var tags = [];
                        
                        if(item.itunes.keywords){
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
					    	image: item.itunes.image ? item.itunes.image : self.image,
					    	episodeNumber: item.itunes.episode ? item.itunes.episode : null,
                            duration: item.itunes.duration,
                            tags: tags,
					    	options: episode && episode.options ? episode.options : {}
                        };

                        ep.options.website = item.link;

                        if(episode && episode.options && episode.options.appleUrl){
                            Episode.findOneAndUpdate({guid: ep.guid}, ep, {new: true, upsert: true}, function(err, d){}).catch(function(err){
                                console.log(err);
                            });
                        }else{
					        axios.get("https://itunes.apple.com/search?term=" + ep.title.replace(/[\s\,\-\&]+/g, "+") + "&entity=podcastEpisode").then(function(resp){
					    	    if(resp.data.results.length > 0 && resp.data.results[0].trackName == ep.title && resp.data.results[0].collectionName == self.name){
					    		    ep.options.appleUrl = resp.data.results[0].collectionViewUrl;
    					    	}
                                
    					    	Episode.findOneAndUpdate({guid: ep.guid}, ep, {new: true, upsert: true}, function(err, d){});
	    				    }).catch(function(err){
                                console.log(err.request.path);
                            });
                        }
                    });
				}
			});

            //https://itunes.apple.com/search?term=Advent+Of+Computing&entity=podcast
            axios.get("https://itunes.apple.com/search?term=" + self.name.replace(/\s+/g, "+") + "&entity=podcast").then(function(resp){
                self.options.appleId = resp.data.results[0].collectionId;
                self.options.appleUrl= resp.data.results[0].collectionViewUrl;

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
		}
	})
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

            cb(colors);
        });
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
