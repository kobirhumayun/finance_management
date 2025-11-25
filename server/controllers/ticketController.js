const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const { getUserNameById, notifyTicketParticipants } = require('../services/ticketNotificationService');
const { getUploadFileSizeLimit, saveTicketAttachment, discardDescriptor } = require('../services/imageService');
const { streamStoredFile } = require('../utils/storageStreamer');

const isAdmin = (user) => user?.role === 'admin';
const isSupport = (user) => user?.role === 'support';

const toObjectId = (value) => {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
        return null;
    }
    return new mongoose.Types.ObjectId(value);
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

const buildTicketAttachmentUrl = (ticketId, attachmentId) => {
    if (!ticketId || !attachmentId) {
        return '';
    }
    return `/api/tickets/${ticketId}/attachments/${attachmentId}/stream`;
};

const mapTicketAttachment = (attachment, ticketId) => {
    if (!attachment || typeof attachment !== 'object') {
        return null;
    }

    const attachmentId = attachment._id ? attachment._id.toString() : null;
    const uploadedAt = attachment.uploadedAt instanceof Date
        ? attachment.uploadedAt.toISOString()
        : attachment.uploadedAt || null;

    const url = (attachment.path && ticketId && attachmentId)
        ? buildTicketAttachmentUrl(ticketId, attachmentId)
        : (attachment.url || '');

    return {
        id: attachmentId,
        filename: attachment.filename || 'Attachment',
        mimeType: attachment.mimeType || attachment.contentType || '',
        size: typeof attachment.size === 'number' ? attachment.size : null,
        width: typeof attachment.width === 'number' ? attachment.width : null,
        height: typeof attachment.height === 'number' ? attachment.height : null,
        url,
        uploadedAt,
        uploadedBy: attachment.uploadedBy || null,
    };
};

const mapTicketForResponse = (ticket) => {
    if (!ticket) {
        return ticket;
    }

    const plainTicket = typeof ticket.toObject === 'function' ? ticket.toObject() : { ...ticket };
    const ticketId = plainTicket._id ? plainTicket._id.toString() : plainTicket.id;

    return {
        ...plainTicket,
        id: ticketId,
        attachments: Array.isArray(plainTicket.attachments)
            ? plainTicket.attachments.map((attachment) => mapTicketAttachment(attachment, ticketId)).filter(Boolean)
            : [],
        activityLog: Array.isArray(plainTicket.activityLog)
            ? plainTicket.activityLog.map((entry) => ({
                ...entry,
                at: entry.at || entry.createdAt || entry.updatedAt || null,
            }))
            : [],
    };
};

const storeAttachment = async ({ file, ticketId, userId }) => {
    if (!file?.buffer || !file.buffer.length) {
        const error = new Error('No file provided.');
        error.statusCode = 400;
        throw error;
    }

    try {
        const descriptor = await saveTicketAttachment({ file, userId, ticketId });
        const attachmentId = new mongoose.Types.ObjectId();
        return {
            _id: attachmentId,
            filename: descriptor.filename || file.originalname || 'attachment',
            mimeType: descriptor.mimeType || 'image/webp',
            size: descriptor.size ?? file.size ?? 0,
            width: descriptor.width ?? null,
            height: descriptor.height ?? null,
            url: buildTicketAttachmentUrl(ticketId, attachmentId),
            uploadedAt: descriptor.uploadedAt || new Date(),
            uploadedBy: userId,
            path: descriptor.path,
        };
    } catch (error) {
        error.statusCode = error.statusCode || 400;
        throw error;
    }
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

        const actorName = await getUserNameById(req.user._id);
        const subjectLine = `Ticket created: ${ticket.subject}`;
        const message = `Ticket "${ticket.subject}" was created by ${actorName}. We will notify you on further updates.`;
        await notifyTicketParticipants({ ticket, subject: subjectLine, text: message });

        res.status(201).json({ ticket: mapTicketForResponse(ticket), attachmentLimitBytes: getUploadFileSizeLimit() });
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
            tickets: tickets.map(mapTicketForResponse),
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit) || 1,
            },
            attachmentLimitBytes: getUploadFileSizeLimit(),
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

        res.status(200).json({ ticket: mapTicketForResponse(ticket), attachmentLimitBytes: getUploadFileSizeLimit() });
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

        ticket.staleSince = undefined;

        await ticket.save();

        res.status(200).json({ ticket: mapTicketForResponse(ticket), attachmentLimitBytes: getUploadFileSizeLimit() });
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
        ticket.staleSince = undefined;
        ticket.activityLog.push({
            actor: req.user._id,
            action: 'status_change',
            message: `Status updated to ${status}`,
        });

        await ticket.save();

        const actorName = await getUserNameById(req.user._id);
        const subjectLine = `Ticket status updated: ${ticket.subject}`;
        const message = `Status for ticket "${ticket.subject}" updated to ${status} by ${actorName}.`;
        await notifyTicketParticipants({ ticket, subject: subjectLine, text: message });

        res.status(200).json({ ticket: mapTicketForResponse(ticket), attachmentLimitBytes: getUploadFileSizeLimit() });
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

        ticket.staleSince = undefined;

        await ticket.save();

        res.status(200).json({ ticket: mapTicketForResponse(ticket), attachmentLimitBytes: getUploadFileSizeLimit() });
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

        ticket.staleSince = undefined;

        await ticket.save();

        res.status(201).json({ attachment: mapTicketAttachment(attachment, ticket._id) });
    } catch (error) {
        next(error);
    }
};

const streamTicketAttachment = async (req, res, next) => {
    try {
        const { ticketId, attachmentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(ticketId) || !mongoose.Types.ObjectId.isValid(attachmentId)) {
            return res.status(400).json({ message: 'Invalid attachment identifier.' });
        }

        const ticket = req.ticket || await Ticket.findById(ticketId).select({ attachments: 1, requester: 1, assignee: 1 });
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }

        if (!hasTicketAccess(ticket, req.user._id, req.user.role)) {
            return res.status(403).json({ message: 'You are not allowed to access this ticket.' });
        }

        const attachment = ticket.attachments?.find((item) => item._id?.toString() === attachmentId);
        if (!attachment?.path) {
            return res.status(404).json({ message: 'Attachment not found.' });
        }

        await streamStoredFile({
            descriptor: attachment,
            res,
            fallbackFilename: attachment.filename || `ticket-${attachmentId}`,
            disposition: 'inline',
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Attachment file is no longer available.' });
        }
        if (error.code === 'ERR_INVALID_PATH') {
            return res.status(404).json({ message: 'Attachment could not be located.' });
        }
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
        if (attachment) {
            try {
                await discardDescriptor(attachment);
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

        ticket.staleSince = undefined;

        await ticket.save();

        res.status(200).json({ message: 'Attachment removed.', ticket: mapTicketForResponse(ticket) });
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
    streamTicketAttachment,
    deleteAttachment,
};
