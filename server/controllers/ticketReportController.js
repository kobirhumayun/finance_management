const Ticket = require('../models/Ticket');
const User = require('../models/User');

const SUPPORT_ROLES = ['support', 'admin'];

const toSafeDate = (value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
};

const getUserDisplayName = (user) => {
    if (!user) {
        return 'Unknown';
    }

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.username || 'Unknown';
};

const findFirstResponseDuration = (ticket, userById) => {
    const requesterId = ticket.requester ? ticket.requester.toString() : null;
    const createdAt = toSafeDate(ticket.createdAt);
    if (!createdAt) {
        return null;
    }

    const sortedLog = (ticket.activityLog || [])
        .filter((entry) => entry && entry.actor)
        .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));

    for (const entry of sortedLog) {
        const actorId = entry.actor ? entry.actor.toString() : null;
        if (!actorId || actorId === requesterId) {
            continue;
        }

        const actor = userById.get(actorId);
        if (!actor || !SUPPORT_ROLES.includes(actor.role)) {
            continue;
        }

        const respondedAt = toSafeDate(entry.at) || toSafeDate(ticket.updatedAt);
        if (respondedAt && respondedAt >= createdAt) {
            return respondedAt.getTime() - createdAt.getTime();
        }
    }

    return null;
};

const findResolutionDuration = (ticket) => {
    const createdAt = toSafeDate(ticket.createdAt);
    if (!createdAt) {
        return null;
    }

    const sortedLog = (ticket.activityLog || [])
        .filter((entry) => entry && entry.at)
        .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));

    for (const entry of sortedLog) {
        if (entry.action !== 'status_change' || typeof entry.message !== 'string') {
            continue;
        }

        const lowerMessage = entry.message.toLowerCase();
        if (!lowerMessage.includes('resolved') && !lowerMessage.includes('closed')) {
            continue;
        }

        const resolvedAt = toSafeDate(entry.at);
        if (resolvedAt && resolvedAt >= createdAt) {
            return resolvedAt.getTime() - createdAt.getTime();
        }
    }

    return null;
};

const buildStatusCounts = (tickets) => {
    const initialCounts = { open: 0, pending: 0, resolved: 0, closed: 0 };

    return tickets.reduce((accumulator, ticket) => {
        if (accumulator[ticket.status] !== undefined) {
            accumulator[ticket.status] += 1;
        }
        return accumulator;
    }, initialCounts);
};

const addToWorkload = (workloadByUser, ticket, userById) => {
    if (!ticket.assignee) {
        return;
    }

    const assigneeId = ticket.assignee.toString();
    const assignee = userById.get(assigneeId);

    if (!assignee || !SUPPORT_ROLES.includes(assignee.role)) {
        return;
    }

    if (!workloadByUser.has(assigneeId)) {
        workloadByUser.set(assigneeId, {
            assigneeId,
            assigneeName: getUserDisplayName(assignee),
            assigneeUsername: assignee.username || null,
            open: 0,
            pending: 0,
            resolved: 0,
            closed: 0,
            total: 0,
        });
    }

    const record = workloadByUser.get(assigneeId);
    if (record[ticket.status] !== undefined) {
        record[ticket.status] += 1;
    }
    record.total += 1;
};

const calculateAverageHours = (durations) => {
    if (!durations.length) {
        return null;
    }

    const total = durations.reduce((sum, value) => sum + value, 0);
    return total / durations.length / (1000 * 60 * 60);
};

const getTicketReport = async (req, res, next) => {
    try {
        const dateFilter = {};
        const { startDate, endDate } = req.query || {};

        const parsedStartDate = startDate ? toSafeDate(startDate) : null;
        const parsedEndDate = endDate ? toSafeDate(endDate) : null;

        if (parsedStartDate) {
            dateFilter.$gte = parsedStartDate;
        }
        if (parsedEndDate) {
            dateFilter.$lte = parsedEndDate;
        }

        const match = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

        const tickets = await Ticket.find(match)
            .select('status createdAt updatedAt requester assignee activityLog')
            .lean();

        const userIds = new Set();
        tickets.forEach((ticket) => {
            if (ticket.requester) {
                userIds.add(ticket.requester.toString());
            }
            if (ticket.assignee) {
                userIds.add(ticket.assignee.toString());
            }
            (ticket.activityLog || []).forEach((entry) => {
                if (entry?.actor) {
                    userIds.add(entry.actor.toString());
                }
            });
        });

        const users = await User.find({ _id: { $in: Array.from(userIds) } })
            .select('firstName lastName username role')
            .lean();

        const userById = new Map(users.map((user) => [user._id.toString(), user]));

        const firstResponseDurations = [];
        const resolutionDurations = [];
        const workloadByUser = new Map();

        tickets.forEach((ticket) => {
            const firstResponseDuration = findFirstResponseDuration(ticket, userById);
            if (firstResponseDuration !== null) {
                firstResponseDurations.push(firstResponseDuration);
            }

            const resolutionDuration = findResolutionDuration(ticket);
            if (resolutionDuration !== null) {
                resolutionDurations.push(resolutionDuration);
            }

            addToWorkload(workloadByUser, ticket, userById);
        });

        const statusCounts = buildStatusCounts(tickets);

        res.status(200).json({
            statusCounts,
            averages: {
                firstResponseHours: calculateAverageHours(firstResponseDurations),
                resolutionHours: calculateAverageHours(resolutionDurations),
            },
            workloads: Array.from(workloadByUser.values()),
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getTicketReport,
};
