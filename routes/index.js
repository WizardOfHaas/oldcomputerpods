var express = require('express');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient;
var { createCanvas, loadImage } = require('canvas');
var useragent = require('express-useragent');
var mongoose = require('mongoose');

var Podcast = require('../models/podcast');
var Episode = require('../models/episode');

/* GET home page. */
router.get('/', function(req, res, next) {
	var res_data = {
		title: "Explore the Digital Past",
		auth: req.cookies.auth
	};

	if(req.cookies.msg && req.cookies.smg != ""){
		res_data.message = req.cookies.msg
		res.cookie('msg', "");
	}

	Episode.find({}).sort({pubDate: -1}).limit(100).populate("podcast").exec(function(err, data){
		if(!err){
            res_data.episodes = data;

			res.render('index.html', res_data);
		}else{
			res.render('error.html', {
				title: "DB Error",
				error: err
			});
		}
	});
});

router.get("/about", function(req, res, next){
    Podcast.count({}, function(err, p){
        Episode.count({}, function(err, e){
            res.render("about.html", {
                title: "About",
                total_podcasts: p,
                total_episodes: e
            });
        });
    });
})

router.get('/podcasts', function(req, res, next) {
	var res_data = {
		title: "All Podcasts",
		auth: req.cookies.auth
	};

	if(req.cookies.msg && req.cookies.smg != ""){
		res_data.message = req.cookies.msg
		res.cookie('msg', "");
	}

	Podcast.find({}).sort({name: 1}).exec(function(err, data){
		if(!err){
            res_data.podcasts = data;

			res.render('podcasts.html', res_data);
		}else{
			res.render('error.html', {
				title: "DB Error",
				error: err
			});
		}
	});
});

router.get('/podcast/:podcast', function(req, res, next){
    Podcast.aggregate([
        {
            $match: {name: req.params.podcast}
        },{
            $lookup: {
                localField: "_id",
                foreignField: "podcast",
                from: "episodes",
                as: "episodes"
            }
        }
    ]).exec(function(err, data){
        if(!err && data){
            var podcast = data[0];

            podcast.episodes.sort(function(a, b){
                return b.pubDate - a.pubDate;
            });

            podcast.links = makeLinkBar(podcast);
            podcast.title = podcast.name;
            podcast.req = req;

			res.render('podcast.html', podcast);
		}else{
			res.render('error.html', {
				title: "DB Error",
				error: err
			});
		}
    });
});

router.get('/episode/:guid', function(req, res, next){
    Episode.findOne({guid: req.params.guid}).populate("podcast").exec(function(err, data){
        if(!err){
            data.links = makeLinkBar(data);
            data.options.colors = data.podcast.options.colors;
            data.req = req;
			data.page_title = data.title + " - " + data.podcast.name;

			res.render('episode.html', data);
		}else{
			res.render('error.html', {
				title: "DB Error",
				error: err
			});
		}
    });
});

router.get('/episode/image/:guid', function(req, res, next){
    Episode.findOne({guid: req.params.guid}).populate("podcast").exec(function(err, data){
        if(!err){
            var width = 1200;
            var height = 600;

            var canvas = createCanvas(width, height);
            var context = canvas.getContext('2d');

            context.fillStyle = '#fff';

            if(data.podcast.options.colors && data.podcast.options.colors.length > 3){
                context.fillStyle = "rgba(" + data.podcast.options.colors[0]._rgb.join(',') + ")";
            }

            context.fillRect(0, 0, width, height);

            loadImage(data.image).then(function(image){
                var pad = 10;
                context.drawImage(image, pad, pad, height - 2 * pad, height - 2 * pad);

                context.font = 'bold 40pt Sans';
                context.textAlign = 'left';
                context.fillStyle = '#000';
    
                if(data.podcast.options.colors && data.podcast.options.colors.length > 3){
                    context.fillStyle = "rgba(" + data.podcast.options.colors[1]._rgb.join(',') + ")";
                }
    
                context.fillText(
                    getLines(context, data.fullTitle, width / 2 - pad, context.font).join("\n"),
                    width / 2, 170, width / 2 - pad
                );

                context.font = 'bold 20pt Sans';

                if(data.podcast.options.colors && data.podcast.options.colors.length > 3){
                    context.fillStyle = "rgba(" + data.podcast.options.colors[2]._rgb.join(',') + ")";
                }

                context.fillText(data.podcast.name, width / 2, 110, width / 2 - pad);

                //res.send(canvas.toBuffer('image/png'));
                res.setHeader('Content-Type', 'image/png');
                canvas.pngStream().pipe(res);
            });
		}else{
			res.render('error.html', {
				title: "DB Error",
				error: err
			});
		}
    });
});

function getLines(ctx,phrase,maxPxLength,textStyle){
    var wa=phrase.split(" "),
        phraseArray=[],
        lastPhrase=wa[0],
        measure=0,
        splitChar=" ";
    if (wa.length <= 1) {
        return wa
    }

    ctx.font = textStyle;

    for (var i=1;i<wa.length;i++) {
        var w=wa[i];
        measure=ctx.measureText(lastPhrase+splitChar+w).width;
        if (measure<maxPxLength) {
            lastPhrase+=(splitChar+w);
        } else {
            phraseArray.push(lastPhrase);
            lastPhrase=w;
        }
        if (i===wa.length-1) {
            phraseArray.push(lastPhrase);
            break;
        }
    }

    return phraseArray;
}

router.get('/player/:guid', function(req, res, next){
    var source = req.headers['user-agent']
    var ua = useragent.parse(source);

    if(ua.isMobile){
        res.redirect("/episode/" + req.params.guid);
    }else{
        Episode.findOne({guid: decodeURIComponent(req.params.guid)}).populate("podcast").exec(function(err, data){
            if(!err && data){
                data.links = makeLinkBar(data);
                data.options.colors = data.podcast.options.colors;

		    	res.render('player.html', data);
		    }else{
			    res.render('error.html', {
    				title: "DB Error",
				    error: err
    			});
	    	}
        });
    }
});

router.get('/playlist', function(req, res, next){
    if(req.query.eps){
        var ids = req.query.eps.split(",").map(function(id){
            return mongoose.Types.ObjectId(id);
        });

        Episode.find({_id: {"$in": ids}}).populate("podcast").exec(function(err, data){
            if(err){
                res.send(err);
            }else{
                var playlist = data.map(function(e){
                    return {
                        "name": e.title,
                        "artist": e.podcast.name,
                        "url": e.media,
                        "cover_art_url": e.image
                    };
                });

                res.render('playlist.html', {
                    title: 'Fancy Playlist',
                    episodes: data,
                    playlist: playlist,
                    query: ""
                })
            }
        });
    }else{
        res.send({});
    }
});

router.get('/search', function(req, res, next){
	Episode.find({
		$text: {
			$search: req.query.q
		}
	}, function(err, data){
		if(!err){
			res.render('search.html', {
				title: "Search Results for '" + req.query.q + "'",
				query: req.query.q,
                results: data,
                ids: data.map(function(e){
                    return e._id;
                }).join(",")
			});
		}else{
			res.send(err);
		}
	});
});

router.get('/tags', function(req, res, next){
    Episode.aggregate([
        {
            $unwind: "$tags"
        },{
            $group: {
                _id: "$tags",
                tag: {$first: "$tags"},
                count: {$sum: 1}
            }
        },{
            $sort: {count: -1}
        },{
            $limit: 50
        }
    ]).then(function(d){
        res.send(d);
    });
});

router.get('/tags/:tag', function(req, res, next){
    Episode.find({tags: req.params.tag}).sort({pudDate: -1}).then(function(d){
        res.render("search.html", {
            title: "'" + req.params.tag + "' Episodes",
            message: "Podcast episodes tagged with '" + req.params.tag + "'",
            results: d,
            ids: d.map(function(e){
                return e._id;
            }).join(",")
        });
    })
});

var linkFormats = [{
    key: "website",
    icon: "fas fa-globe"
},{
    key: "appleUrl",
    icon: "fas fa-podcast"
},{
    key: "googleUrl",
    icon: "fab fa-google"
},{
    key: "spotifyUrl",
    icon: "fab fa-spotify"
}];

function makeLinkBar(item){
    var links = "";

    if(item.feed){
        links += '<a href="' + item.feed + '" class="link-icon"><div class="badge"><i class="fas fa-rss fa-2x"></i></div></a>';
    }

    linkFormats.forEach(function(d){
        if(item.options && item.options[d.key]){
            links += '<a href="' + item.options[d.key]+ '" class="link-icon"><div class="badge"><i class="' + d.icon + ' fa-2x"></i></div></a>'
        }
    });

    return links;
}

module.exports = router;
