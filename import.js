var database = require('./database');
var Podcast = require('./models/podcast');

var shows = require("./import.json");

shows.forEach(function(p){
    (new Podcast(p)).save(function(){});
});
