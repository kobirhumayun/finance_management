const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { formatUserName, getUserNameById, notifyTicketParticipants } = require('../services/ticketNotificationService');
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

const resolveActorName = async (user) => {
    if (user) {
        return formatUserName(user);
    }

    return getUserNameById(user?._id);
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
        uploadedBy: attachment.uploadedBy ? attachment.uploadedBy.toString() : null,
    };
};

const mapTicketForResponse = (ticket, { includeDetails = true } = {}) => {
    if (!ticket) {
        return ticket;
    }

    const plainTicket = typeof ticket.toObject === 'function' ? ticket.toObject() : { ...ticket };
    const ticketId = plainTicket._id ? plainTicket._id.toString() : plainTicket.id;

    const mappedTicket = {
        ...plainTicket,
        id: ticketId,
        requester: plainTicket.requester ? plainTicket.requester.toString() : plainTicket.requester,
        assignee: plainTicket.assignee ? plainTicket.assignee.toString() : plainTicket.assignee,
    };

    const attachmentCount = typeof plainTicket.attachmentCount === 'number'
        ? plainTicket.attachmentCount
        : (Array.isArray(plainTicket.attachments) ? plainTicket.attachments.length : 0);

    mappedTicket.attachmentCount = attachmentCount;

    if (includeDetails) {
        mappedTicket.attachments = Array.isArray(plainTicket.attachments)
            ? plainTicket.attachments.map((attachment) => mapTicketAttachment(attachment, ticketId)).filter(Boolean)
            : [];
        mappedTicket.activityLog = Array.isArray(plainTicket.activityLog)
            ? plainTicket.activityLog.map((entry) => ({
                ...entry,
                actor: entry.actor ? entry.actor.toString() : null,
                at: entry.at || entry.createdAt || entry.updatedAt || null,
                attachments: Array.isArray(entry.attachments)
                    ? entry.attachments.map((attachment) => mapTicketAttachment(attachment, ticketId)).filter(Boolean)
                    : [],
            }))
            : [];
    }

    return mappedTicket;
};

const updateAttachmentCount = (ticket, delta) => {
    const currentCount = typeof ticket.attachmentCount === 'number'
        ? ticket.attachmentCount
        : (Array.isArray(ticket.attachments) ? ticket.attachments.length : 0);

    const nextCount = Math.max(0, currentCount + delta);
    ticket.attachmentCount = nextCount;
};

const buildUserLookupFromTickets = async (tickets = []) => {
    const ticketList = Array.isArray(tickets) ? tickets : [tickets];
    const userIds = new Set();

    const addId = (value) => {
        if (!value) {
            return;
        }

        const idString = typeof value === 'string' ? value : value.toString?.();
        if (idString && mongoose.Types.ObjectId.isValid(idString)) {
            userIds.add(idString);
        }
    };

    ticketList.filter(Boolean).forEach((ticket) => {
        addId(ticket.requester);
        addId(ticket.assignee);

        if (Array.isArray(ticket.attachments)) {
            ticket.attachments.forEach((attachment) => addId(attachment?.uploadedBy));
        }

        if (Array.isArray(ticket.activityLog)) {
            ticket.activityLog.forEach((entry) => addId(entry?.actor));
            ticket.activityLog.forEach((entry) => {
                if (Array.isArray(entry?.attachments)) {
                    entry.attachments.forEach((attachment) => addId(attachment?.uploadedBy));
                }
            });
        }
    });

    if (userIds.size === 0) {
        return {};
    }

    const users = await User.find({ _id: { $in: [...userIds].map((id) => new mongoose.Types.ObjectId(id)) } }).lean();

    return users.reduce((lookup, user) => {
        const id = user._id?.toString();
        if (!id) {
            return lookup;
        }

        lookup[id] = {
            id,
            displayName: formatUserName(user),
            email: user.email || '',
            role: user.role || 'user',
        };
        return lookup;
    }, {});
};

const mapTicketsWithUsers = async (tickets, { includeDetails = true, includeUsers = true } = {}) => {
    const mappedTickets = (Array.isArray(tickets) ? tickets : [tickets])
        .map((ticket) => mapTicketForResponse(ticket, { includeDetails }))
        .filter(Boolean);
    const users = includeUsers ? await buildUserLookupFromTickets(mappedTickets) : {};
    return { tickets: mappedTickets, users };
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
        const { subject, description, category, priority, requester: requesterInput } = req.body;
        const files = Array.isArray(req.files) ? req.files : [];
        if (!subject || !description) {
            return res.status(400).json({ message: 'Subject and description are required.' });
        }

        let requesterId = req.user._id;
        if (requesterInput && (isAdmin(req.user) || isSupport(req.user))) {
            const parsedRequester = toObjectId(requesterInput);
            if (!parsedRequester) {
                return res.status(400).json({ message: 'Invalid requester provided.' });
            }
            requesterId = parsedRequester;
        }

        const ticket = new Ticket({
            requester: requesterId,
            subject: subject.trim(),
            description: description.trim(),
            category: category?.trim() || undefined,
            priority: priority || undefined,
            activityLog: [],
        });

        if (files.length) {
            const attachments = await Promise.all(
                files.map((file) => storeAttachment({ file, ticketId: ticket._id, userId: req.user._id })),
            );
            ticket.attachments.push(...attachments);
            updateAttachmentCount(ticket, attachments.length);
        }

        await ticket.save();

        const actorName = await resolveActorName(req.user);
        const subjectLine = `Ticket created: ${ticket.subject}`;
        const message = `Ticket "${ticket.subject}" was created by ${actorName}. We will notify you on further updates.`;
        await notifyTicketParticipants({ ticket, subject: subjectLine, text: message });

        const { tickets: mappedTickets, users } = await mapTicketsWithUsers([ticket]);
        res.status(201).json({ ticket: mappedTickets[0], users, attachmentLimitBytes: getUploadFileSizeLimit() });
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

        const baseFilters = {};

        if (status) {
            baseFilters.status = status;
        }
        if (priority) {
            baseFilters.priority = priority;
        }
        if (category) {
            baseFilters.category = category;
        }
        if (assignee && (isAdmin(req.user) || isSupport(req.user))) {
            const assigneeId = toObjectId(assignee);
            if (assigneeId) {
                baseFilters.assignee = assigneeId;
            }
        }

        if (isAdmin(req.user) || isSupport(req.user)) {
            const requesterId = toObjectId(requester);
            if (requesterId) {
                baseFilters.requester = requesterId;
            }
        } else {
            baseFilters.requester = req.user._id;
        }

        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const skip = (safePage - 1) * safeLimit;

        const projection = {
            subject: 1,
            description: 1,
            status: 1,
            priority: 1,
            category: 1,
            updatedAt: 1,
            createdAt: 1,
            attachmentCount: 1,
        };

        const searchTerm = (typeof search === 'string' && search.trim()) ? search.trim() : '';
        const usingTextSearch = Boolean(searchTerm);
        const filters = usingTextSearch ? { ...baseFilters, $text: { $search: searchTerm } } : { ...baseFilters };

        if (usingTextSearch) {
            projection.score = { $meta: 'textScore' };
        }

        const sort = usingTextSearch ? { score: { $meta: 'textScore' }, updatedAt: -1 } : { updatedAt: -1 };

        const executeQuery = () => Promise.all([
            Ticket.find(filters, projection)
                .sort(sort)
                .skip(skip)
                .limit(safeLimit)
                .lean(),
            Ticket.countDocuments(filters),
        ]);

        let tickets;
        let total;

        try {
            [tickets, total] = await executeQuery();
        } catch (error) {
            if (usingTextSearch) {
                const regex = new RegExp(searchTerm, 'i');
                const legacyFilters = { ...baseFilters, $or: [{ subject: regex }, { description: regex }] };
                const legacyProjection = { ...projection };
                delete legacyProjection.score;

                [tickets, total] = await Promise.all([
                    Ticket.find(legacyFilters, legacyProjection)
                        .sort({ updatedAt: -1 })
                        .skip(skip)
                        .limit(safeLimit)
                        .lean(),
                    Ticket.countDocuments(legacyFilters),
                ]);
            } else {
                throw error;
            }
        }

        const { tickets: mappedTickets } = await mapTicketsWithUsers(tickets, {
            includeDetails: false,
            includeUsers: false,
        });

        res.status(200).json({
            tickets: mappedTickets,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit) || 1,
            },
            users: {},
            attachmentLimitBytes: getUploadFileSizeLimit(),
        });
    } catch (error) {
        next(error);
    }
};

const getTicket = async (req, res, next) => {
    try {
        const ticket = req.ticket;

        const { tickets: mappedTickets, users } = await mapTicketsWithUsers([ticket]);

        res.status(200).json({ ticket: mappedTickets[0], users, attachmentLimitBytes: getUploadFileSizeLimit() });
    } catch (error) {
        next(error);
    }
};

const addComment = async (req, res, next) => {
    try {
        const { ticketId } = req.params;
        const { comment } = req.body;
        const files = Array.isArray(req.files) ? req.files : [];

        if ((!comment || !comment.trim()) && files.length === 0) {
            return res.status(400).json({ message: 'Comment is required.' });
        }

        const ticket = req.ticket;

        const savedAttachments = [];

        if (files.length) {
            const attachments = await Promise.all(
                files.map((file) => storeAttachment({ file, ticketId, userId: req.user._id })),
            );
            ticket.attachments.push(...attachments);
            savedAttachments.push(...attachments);
            updateAttachmentCount(ticket, attachments.length);
        }

        ticket.activityLog.push({
            actor: req.user._id,
            action: 'comment',
            message: comment?.trim?.() || undefined,
            attachments: savedAttachments,
        });

        ticket.staleSince = undefined;

        await ticket.save();

        const { tickets: mappedTickets, users } = await mapTicketsWithUsers([ticket]);

        res.status(200).json({ ticket: mappedTickets[0], users, attachmentLimitBytes: getUploadFileSizeLimit() });
    } catch (error) {
        next(error);
    }
};

const updateStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ['open', 'pending', 'resolved', 'closed'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid ticket status.' });
        }

        const ticket = req.ticket;

        ticket.status = status;
        ticket.staleSince = undefined;
        ticket.activityLog.push({
            actor: req.user._id,
            action: 'status_change',
            message: `Status updated to ${status}`,
        });

        await ticket.save();

        const actorName = await resolveActorName(req.user);
        const subjectLine = `Ticket status updated: ${ticket.subject}`;
        const message = `Status for ticket "${ticket.subject}" updated to ${status} by ${actorName}.`;
        await notifyTicketParticipants({ ticket, subject: subjectLine, text: message });

        const { tickets: mappedTickets, users } = await mapTicketsWithUsers([ticket]);

        res.status(200).json({ ticket: mappedTickets[0], users, attachmentLimitBytes: getUploadFileSizeLimit() });
    } catch (error) {
        next(error);
    }
};

const updateAssignee = async (req, res, next) => {
    try {
        const { assignee } = req.body;

        if (!isAdmin(req.user) && !isSupport(req.user)) {
            return res.status(403).json({ message: 'Only support or admin can reassign tickets.' });
        }

        const ticket = req.ticket;

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

        const { tickets: mappedTickets, users } = await mapTicketsWithUsers([ticket]);

        res.status(200).json({ ticket: mappedTickets[0], users, attachmentLimitBytes: getUploadFileSizeLimit() });
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

        const ticket = req.ticket;

        const attachment = await storeAttachment({ file: req.file, ticketId, userId: req.user._id });

        ticket.attachments.push(attachment);
        updateAttachmentCount(ticket, 1);
        ticket.activityLog.push({
            actor: req.user._id,
            action: 'attachment_added',
            message: attachment.filename,
            attachments: [attachment],
        });

        ticket.staleSince = undefined;

        await ticket.save();

        const mappedAttachment = mapTicketAttachment(attachment, ticket._id);
        const users = await buildUserLookupFromTickets([{ attachments: [mappedAttachment] }]);

        res.status(201).json({ attachment: mappedAttachment, users });
    } catch (error) {
        next(error);
    }
};

const streamTicketAttachment = async (req, res, next) => {
    try {
        const { attachmentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
            return res.status(400).json({ message: 'Invalid attachment identifier.' });
        }

        const ticket = req.ticket;

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
        const { attachmentId } = req.params;

        const ticket = req.ticket;

        const attachmentIndex = ticket.attachments.findIndex((item) => item._id?.toString() === attachmentId);
        if (attachmentIndex === -1) {
            return res.status(404).json({ message: 'Attachment not found.' });
        }

        const [attachment] = ticket.attachments.splice(attachmentIndex, 1);
        updateAttachmentCount(ticket, -1);
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

        const { tickets: mappedTickets, users } = await mapTicketsWithUsers([ticket]);

        res.status(200).json({ message: 'Attachment removed.', ticket: mappedTickets[0], users });
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
