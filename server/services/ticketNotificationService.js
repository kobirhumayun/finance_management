const User = require('../models/User');
const { sendNotification } = require('./notificationService');

const formatUserName = (user) => {
    if (!user) {
        return 'system';
    }

    return user.firstName || user.username || user.email || 'system';
};

const fetchUsersByIds = async (ids = []) => {
    const uniqueIds = [...new Set(ids.filter(Boolean).map((id) => id.toString()))];
    if (!uniqueIds.length) {
        return [];
    }

    return User.find({ _id: { $in: uniqueIds } }).lean();
};

const notifyUsers = async (users, subject, text) => {
    await Promise.all(
        users.map(async (user) => {
            try {
                await sendNotification({
                    method: 'email',
                    user,
                    subject,
                    text,
                });
            } catch (notificationError) {
                console.warn(`Notification dispatch failed for ${user.email}:`, notificationError);
            }
        })
    );
};

const notifyTicketParticipants = async ({
    ticket,
    subject,
    text,
    includeRequester = true,
    includeAssignee = true,
    excludeUserId = null,
}) => {
    try {
        const recipientIds = [];

        if (includeRequester && ticket.requester) {
            recipientIds.push(ticket.requester);
        }

        if (includeAssignee && ticket.assignee) {
            recipientIds.push(ticket.assignee);
        }

        // Filter out the excluded user (e.g., the one who performed the action)
        const filteredRecipientIds = excludeUserId
            ? recipientIds.filter((id) => id.toString() !== excludeUserId.toString())
            : recipientIds;

        const recipients = await fetchUsersByIds(filteredRecipientIds);
        if (!recipients.length) {
            return false;
        }

        await notifyUsers(recipients, subject, text);
        return true;
    } catch (error) {
        console.error('Failed to send ticket notifications:', error);
        return false;
    }
};

const getUserNameById = async (userId) => {
    if (!userId) {
        return 'system';
    }

    const user = await User.findById(userId).lean();
    return formatUserName(user);
};

module.exports = {
    formatUserName,
    getUserNameById,
    notifyTicketParticipants,
};
