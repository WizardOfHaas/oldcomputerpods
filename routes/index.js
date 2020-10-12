var express = require('express');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient;

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

			res.render('episode.html', data);
		}else{
			res.render('error.html', {
				title: "DB Error",
				error: err
			});
		}
    });
});

router.get('/player/:guid', function(req, res, next){
    console.log(decodeURIComponent(req.params.guid));

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
				results: data
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
            $limit: 20
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
            results: d
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
