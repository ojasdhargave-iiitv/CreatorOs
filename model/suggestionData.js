const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  category: { type: String, required: true },
  captions: [String],
  hashtags: [String],
  songs: [
    {
      title: String,
      mood: String
    }
  ]
});

module.exports =
  mongoose.models.Suggestion ||
  mongoose.model('Suggestion', suggestionSchema);
