var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

var episodeSchema = new mongoose.Schema({
    title: String,
    fullTitle: String,
	podcast: {type: ObjectId, ref: "Podcast", index: true},
	link: String,
	pubDate: Date,
	media: String,
	description: String,
	guid: {type: String, unique: true},
	image: String,
	episodeNumber: Number,
    duration: String,
    tags: mongoose.Schema.Types.Mixed,
    options: mongoose.Schema.Types.Mixed
});

episodeSchema.index({title: 'text', description: 'text'});

module.exports = mongoose.model("Episode", episodeSchema);
