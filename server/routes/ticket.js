const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/casbinAuthorize');
const { upload } = require('../middleware/uploadMiddleware');

router.use(authenticate);

router.post('/', authorize('tickets', 'write'), ticketController.createTicket);
router.get('/', authorize('tickets', 'read'), ticketController.listTickets);
router.get('/:ticketId', authorize('tickets', 'read'), ticketController.getTicket);
router.post('/:ticketId/comments', authorize('tickets', 'update'), ticketController.addComment);
router.patch('/:ticketId/status', authorize('tickets', 'update'), ticketController.updateStatus);
router.patch('/:ticketId/assignee', authorize('tickets', 'update'), ticketController.updateAssignee);
router.post(
    '/:ticketId/attachments',
    authorize('tickets', 'update'),
    upload.single('attachment'),
    ticketController.uploadAttachment,
);
router.delete(
    '/:ticketId/attachments/:attachmentId',
    authorize('tickets', 'delete'),
    ticketController.deleteAttachment,
);

module.exports = router;
