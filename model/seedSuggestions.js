// scripts/seedSuggestions.js
const mongoose = require('mongoose');
const Suggestion = require('../model/suggestionData');
const suggestions = require('../model/suggestion');

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/yourdb');
  for (const [category, data] of Object.entries(suggestions)) {
    await Suggestion.updateOne(
      { category },
      { $set: { captions: data.captions, hashtags: data.hashtags, songs: data.songs } },
      { upsert: true }
    );
  }
  console.log('Seeded!');
  mongoose.disconnect();
}

seed();