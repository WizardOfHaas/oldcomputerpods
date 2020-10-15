var database = require('./database');
var Podcast = require('./models/podcast');

var shows = require("./shows.json");

shows.forEach(function(p){
    (new Podcast(p)).save(function(){});
});