const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/casbinAuthorize');
const { upload } = require('../middleware/uploadMiddleware');
const { ensureTicketAccess } = require('../middleware/ticketAccessMiddleware');

router.use(authenticate);

router.post('/', authorize('tickets', 'write'), ticketController.createTicket);
router.get('/', authorize('tickets', 'read'), ticketController.listTickets);
router.get('/:ticketId', authorize('tickets', 'read'), ensureTicketAccess, ticketController.getTicket);
router.post('/:ticketId/comments', authorize('tickets', 'update'), ensureTicketAccess, ticketController.addComment);
router.patch('/:ticketId/status', authorize('tickets', 'update'), ensureTicketAccess, ticketController.updateStatus);
router.patch('/:ticketId/assignee', authorize('tickets', 'update'), ensureTicketAccess, ticketController.updateAssignee);
router.post(
    '/:ticketId/attachments',
    authorize('tickets', 'update'),
    ensureTicketAccess,
    upload.single('attachment'),
    ticketController.uploadAttachment,
);
router.delete(
    '/:ticketId/attachments/:attachmentId',
    authorize('tickets', 'delete'),
    ensureTicketAccess,
    ticketController.deleteAttachment,
);

module.exports = router;
