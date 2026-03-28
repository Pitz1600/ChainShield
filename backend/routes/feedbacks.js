const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
    getAllFeedbacks,
    spamTest,
    getAkismetStatus,
    cleanupSpam,
    createFeedback,
    updateFeedback,
    deleteFeedback,
    addReply,
    updateReply,
    deleteReply,
    approveAction,
    rejectAction,
    approveReplyAction,
    rejectReplyAction
} = require('../controllers/feedbackController');

router.use(authMiddleware);

router.route('/akismet-status')
    .get(getAkismetStatus);

router.route('/cleanup-spam')
    .post(cleanupSpam);

router.route('/spam-test')
    .post(spamTest);

router.route('/')
    .get(getAllFeedbacks)
    .post(createFeedback);

router.route('/:id')
    .put(updateFeedback)
    .delete(deleteFeedback);

router.route('/:id/approve')
    .put(approveAction);

router.route('/:id/reject')
    .put(rejectAction);

router.route('/:id/replies')
    .post(addReply);

router.route('/:id/replies/:replyId')
    .put(updateReply)
    .delete(deleteReply);

router.route('/:id/replies/:replyId/approve')
    .put(approveReplyAction);

router.route('/:id/replies/:replyId/reject')
    .put(rejectReplyAction);

module.exports = router;
