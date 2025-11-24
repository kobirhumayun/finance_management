const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const { ensureUploadsRoot, getUploadFileSizeLimit, getUploadsRoot } = require('../services/imageService');
const { sanitizeFilename } = require('../utils/storageStreamer');

const isAdmin = (user) => user?.role === 'admin';
const isSupport = (user) => user?.role === 'support';

const toObjectId = (value) => {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
        return null;
    }
    return new mongoose.Types.ObjectId(value);
};

const sanitizeSegment = (value) => {
    if (!value) {
        return 'common';
    }
    const stringValue = value.toString();
    const sanitized = stringValue.replace(/[^a-zA-Z0-9-_]/g, '');
    return sanitized || 'common';
};

const hasTicketAccess = (ticket, userId, userRole) => {
    if (!ticket || !userId) {
        return false;
    }
    if (isAdmin({ role: userRole }) || isSupport({ role: userRole })) {
        return true;
    }
    return ticket.requester?.toString() === userId || ticket.assignee?.toString() === userId;
};

const buildAttachmentRecord = ({ file, storedPath, relativePath, userId }) => ({
    filename: file.originalname || 'attachment',
    url: `/api/uploads/${relativePath.split(path.sep).join('/')}`,
    contentType: file.mimetype || 'application/octet-stream',
    size: file.size || 0,
    uploadedAt: new Date(),
    uploadedBy: userId,
    path: storedPath,
});

const storeAttachment = async ({ file, ticketId, userId }) => {
    if (!file?.buffer || !file.buffer.length) {
        const error = new Error('No file provided.');
        error.statusCode = 400;
        throw error;
    }
    if (file.size && file.size > getUploadFileSizeLimit()) {
        const error = new Error('File exceeds allowed size.');
        error.statusCode = 400;
        throw error;
    }

    const uploadsRoot = getUploadsRoot();
    const safeUser = sanitizeSegment(userId);
    const safeTicket = sanitizeSegment(ticketId);
    const uniqueName = `${randomUUID()}-${sanitizeFilename(file.originalname || 'attachment')}`;
    const relativePath = path.join('tickets', safeUser, safeTicket, uniqueName);
    const absolutePath = path.join(uploadsRoot, relativePath);

    await ensureUploadsRoot();
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);

    return buildAttachmentRecord({ file, storedPath: absolutePath, relativePath, userId });
};

const createTicket = async (req, res, next) => {
    try {
        const { subject, description, category, priority } = req.body;
        if (!subject || !description) {
            return res.status(400).json({ message: 'Subject and description are required.' });
        }

        const ticket = await Ticket.create({
            requester: req.user._id,
            subject: subject.trim(),
            description: description.trim(),
            category: category?.trim() || undefined,
            priority: priority || undefined,
            activityLog: [
                {
                    actor: req.user._id,
                    action: 'created',
                    message: 'Ticket created',
                },
            ],
        });

        res.status(201).json({ ticket });
    } catch (error) {
        next(error);
    }
};

const listTickets = async (req, res, next) => {
    try {
        const {
            status,
            priority,
            category,
            assignee,
            requester,
            search,
            page = 1,
            limit = 10,
        } = req.query;

        const filters = {};

        if (status) {
            filters.status = status;
        }
        if (priority) {
            filters.priority = priority;
        }
        if (category) {
            filters.category = category;
        }
        if (assignee && (isAdmin(req.user) || isSupport(req.user))) {
            const assigneeId = toObjectId(assignee);
            if (assigneeId) {
                filters.assignee = assigneeId;
            }
        }

        if (isAdmin(req.user) || isSupport(req.user)) {
            const requesterId = toObjectId(requester);
            if (requesterId) {
                filters.requester = requesterId;
            }
        } else {
            filters.requester = req.user._id;
        }

        if (search && typeof search === 'string') {
            filters.subject = { $regex: new RegExp(search.trim(), 'i') };
        }

        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const skip = (safePage - 1) * safeLimit;

        const [tickets, total] = await Promise.all([
            Ticket.find(filters)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean(),
            Ticket.countDocuments(filters),
        ]);

        res.status(200).json({
            tickets,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit) || 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

const getTicket = async (req, res, next) => {
    try {
        const { ticketId } = req.params;
        const ticket = req.ticket || (mongoose.Types.ObjectId.isValid(ticketId) ? await Ticket.findById(ticketId) : null);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }

        if (!hasTicketAccess(ticket, req.user._id, req.user.role)) {
            return res.status(403).json({ message: 'You are not allowed to access this ticket.' });
        }

        res.status(200).json({ ticket });
    } catch (error) {
        next(error);
    }
};

const addComment = async (req, res, next) => {
    try {
        const { ticketId } = req.params;
        const { comment } = req.body;

        if (!comment || !comment.trim()) {
            return res.status(400).json({ message: 'Comment is required.' });
        }

        const ticket = req.ticket || (mongoose.Types.ObjectId.isValid(ticketId) ? await Ticket.findById(ticketId) : null);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }

        if (!hasTicketAccess(ticket, req.user._id, req.user.role)) {
            return res.status(403).json({ message: 'You are not allowed to comment on this ticket.' });
        }

        ticket.activityLog.push({
            actor: req.user._id,
            action: 'comment',
            message: comment.trim(),
        });

        await ticket.save();

        res.status(200).json({ ticket });
    } catch (error) {
        next(error);
    }
};

const updateStatus = async (req, res, next) => {
    try {
        const { ticketId } = req.params;
        const { status } = req.body;
        const allowedStatuses = ['open', 'pending', 'resolved', 'closed'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid ticket status.' });
        }

        const ticket = req.ticket || (mongoose.Types.ObjectId.isValid(ticketId) ? await Ticket.findById(ticketId) : null);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }

        if (!hasTicketAccess(ticket, req.user._id, req.user.role)) {
            return res.status(403).json({ message: 'You are not allowed to update this ticket.' });
        }

        ticket.status = status;
        ticket.activityLog.push({
            actor: req.user._id,
            action: 'status_change',
            message: `Status updated to ${status}`,
        });

        await ticket.save();

        res.status(200).json({ ticket });
    } catch (error) {
        next(error);
    }
};

const updateAssignee = async (req, res, next) => {
    try {
        const { ticketId } = req.params;
        const { assignee } = req.body;

        if (!isAdmin(req.user) && !isSupport(req.user)) {
            return res.status(403).json({ message: 'Only support or admin can reassign tickets.' });
        }

        const ticket = req.ticket || (mongoose.Types.ObjectId.isValid(ticketId) ? await Ticket.findById(ticketId) : null);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }

        const assigneeId = toObjectId(assignee);
        if (!assigneeId) {
            ticket.assignee = undefined;
        } else {
            ticket.assignee = assigneeId;
        }

        ticket.activityLog.push({
            actor: req.user._id,
            action: 'assignee_change',
            message: assigneeId ? `Assigned to ${assigneeId.toString()}` : 'Assignee cleared',
        });

        await ticket.save();

        res.status(200).json({ ticket });
    } catch (error) {
        next(error);
    }
};

const uploadAttachment = async (req, res, next) => {
    try {
        const { ticketId } = req.params;
        if (!req.file) {
            return res.status(400).json({ message: 'No attachment provided.' });
        }

        const ticket = req.ticket || (mongoose.Types.ObjectId.isValid(ticketId) ? await Ticket.findById(ticketId) : null);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }

        if (!hasTicketAccess(ticket, req.user._id, req.user.role)) {
            return res.status(403).json({ message: 'You are not allowed to modify this ticket.' });
        }

        const attachment = await storeAttachment({ file: req.file, ticketId, userId: req.user._id });

        ticket.attachments.push(attachment);
        ticket.activityLog.push({
            actor: req.user._id,
            action: 'attachment_added',
            message: attachment.filename,
        });

        await ticket.save();

        res.status(201).json({ attachment });
    } catch (error) {
        next(error);
    }
};

const deleteAttachment = async (req, res, next) => {
    try {
        const { ticketId, attachmentId } = req.params;

        const ticket = req.ticket || (mongoose.Types.ObjectId.isValid(ticketId) ? await Ticket.findById(ticketId) : null);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }

        if (!hasTicketAccess(ticket, req.user._id, req.user.role)) {
            return res.status(403).json({ message: 'You are not allowed to modify this ticket.' });
        }

        const attachmentIndex = ticket.attachments.findIndex((item) => item._id?.toString() === attachmentId);
        if (attachmentIndex === -1) {
            return res.status(404).json({ message: 'Attachment not found.' });
        }

        const [attachment] = ticket.attachments.splice(attachmentIndex, 1);
        if (attachment?.path) {
            try {
                await fs.unlink(path.resolve(attachment.path));
            } catch (unlinkError) {
                if (unlinkError.code !== 'ENOENT') {
                    console.error('Failed to remove attachment from disk:', unlinkError);
                }
            }
        }

        ticket.activityLog.push({
            actor: req.user._id,
            action: 'attachment_removed',
            message: attachment.filename,
        });

        await ticket.save();

        res.status(200).json({ message: 'Attachment removed.' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTicket,
    listTickets,
    getTicket,
    addComment,
    updateStatus,
    updateAssignee,
    uploadAttachment,
    deleteAttachment,
};
