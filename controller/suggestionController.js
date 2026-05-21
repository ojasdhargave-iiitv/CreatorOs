const suggestions = require('../model/suggestionData');
const services = require('../services.config');

exports.getPage = (req, res) => {
  const categories = Object.keys(suggestions);
  res.render('suggestions', { categories, result: null, selected: null, services });
};

exports.getSuggestions = (req, res) => {
  const { category } = req.body;
  const categories = Object.keys(suggestions);
  const result = suggestions[category] || null;
  res.render('suggestions', { categories, result, selected: category, services });
};