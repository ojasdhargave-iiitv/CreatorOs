const express = require('express');
const { getInstagramProfile } = require('../controller/instagramController');

const router = express.Router();

router.get('/profile', getInstagramProfile);

module.exports = router;
