const express = require('express');
const router = express.Router();
const { getCreatorCrmPage, sendCollaboratorInvite } = require('../controller/collaborationController');

router.get('/', getCreatorCrmPage);
router.post('/invite', sendCollaboratorInvite);

module.exports = router;
