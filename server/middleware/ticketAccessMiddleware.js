const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');

const isPrivilegedUser = (user) => ['admin', 'support'].includes(user?.role);

const isTicketParticipant = (ticket, userId) => {
    if (!ticket || !userId) {
        return false;
    }

    const userIdString = userId.toString();
    return (
        ticket.requester?.toString() === userIdString ||
        ticket.assignee?.toString() === userIdString
    );
};

const ensureTicketAccess = async (req, res, next) => {
    const { ticketId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        return res.status(400).json({ message: 'Invalid ticket identifier.' });
    }

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found.' });
    }

    if (isPrivilegedUser(req.user) || isTicketParticipant(ticket, req.user._id)) {
        req.ticket = ticket;
        return next();
    }

    return res.status(403).json({ message: 'You are not allowed to access this ticket.' });
};

module.exports = { ensureTicketAccess };
