const express = require('express');
const router = express.Router();
const { getPage, getSuggestions } = require('../controller/suggestionController');

router.get('/', getPage);
router.post('/', getSuggestions);

module.exports = router;