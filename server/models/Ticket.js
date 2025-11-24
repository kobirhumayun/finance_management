const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const visibilitySchema = new Schema({
    requesterCanView: {
        type: Boolean,
        default: true
    },
    assigneeCanView: {
        type: Boolean,
        default: true
    }
}, { _id: false });

const attachmentSchema = new Schema({
    filename: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    contentType: {
        type: String
    },
    size: {
        type: Number
    },
    path: {
        type: String
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
});

const activityLogSchema = new Schema({
    actor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true
    },
    message: {
        type: String
    },
    at: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const ticketSchema = new Schema({
    requester: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    assignee: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        trim: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['open', 'pending', 'resolved', 'closed'],
        default: 'open',
        index: true
    },
    commentVisibility: {
        type: visibilitySchema,
        default: () => ({})
    },
    attachments: [attachmentSchema],
    activityLog: [activityLogSchema]
}, {
    timestamps: true
});

ticketSchema.index({ updatedAt: 1 });

ticketSchema.index({ requester: 1, status: 1 });
ticketSchema.index({ assignee: 1, status: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
