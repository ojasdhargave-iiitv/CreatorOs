const express = require('express');
const router = express.Router();
const { getCreatorCrmPage, sendCollaboratorInvite } = require('../controller/collaborationController');
const { preventContributorWrites } = require('../middleware/auth');

router.get('/', getCreatorCrmPage);
router.post('/invite', preventContributorWrites, sendCollaboratorInvite);

module.exports = router;
