const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
    __test__: { mapTicketForResponse },
} = require('../controllers/ticketController');

describe('ticketController attachment mapping', () => {
    test('keeps attachments linked to their originating comment or ticket', () => {
        const ticketId = new mongoose.Types.ObjectId();
        const requesterId = new mongoose.Types.ObjectId();

        const initialAttachmentId = new mongoose.Types.ObjectId();
        const replyAttachmentId = new mongoose.Types.ObjectId();
        const replyPdfAttachmentId = new mongoose.Types.ObjectId();
        const laterAttachmentId = new mongoose.Types.ObjectId();

        const ticket = {
            _id: ticketId,
            requester: requesterId,
            subject: 'Login not working',
            description: 'Cannot log in after password reset.',
            attachments: [
                {
                    _id: initialAttachmentId,
                    filename: 'reset-steps.pdf',
                    mimeType: 'application/pdf',
                    size: 1024,
                    path: '/uploads/reset-steps.pdf',
                    uploadedBy: requesterId,
                    uploadedAt: new Date('2024-10-01T10:00:00Z'),
                },
            ],
            activityLog: [
                {
                    actor: requesterId,
                    action: 'comment',
                    message: 'Initial details, no files attached here.',
                    attachments: [],
                    at: new Date('2024-10-01T10:05:00Z'),
                },
                {
                    actor: requesterId,
                    action: 'comment',
                    message: 'Here are the screenshots and PDF.',
                    attachments: [
                        {
                            _id: replyAttachmentId,
                            filename: 'login-error.png',
                            mimeType: 'image/png',
                            size: 2048,
                            path: '/uploads/login-error.png',
                            uploadedBy: requesterId,
                            uploadedAt: new Date('2024-10-01T10:10:00Z'),
                        },
                        {
                            _id: replyPdfAttachmentId,
                            filename: 'error-log.pdf',
                            mimeType: 'application/pdf',
                            size: 4096,
                            path: '/uploads/error-log.pdf',
                            uploadedBy: requesterId,
                            uploadedAt: new Date('2024-10-01T10:10:01Z'),
                        },
                    ],
                    at: new Date('2024-10-01T10:10:00Z'),
                },
                {
                    actor: requesterId,
                    action: 'comment',
                    message: 'Another reply with just one image.',
                    attachments: [
                        {
                            _id: laterAttachmentId,
                            filename: 'settings.jpg',
                            mimeType: 'image/jpeg',
                            size: 5120,
                            path: '/uploads/settings.jpg',
                            uploadedBy: requesterId,
                            uploadedAt: new Date('2024-10-01T10:15:00Z'),
                        },
                    ],
                    at: new Date('2024-10-01T10:15:00Z'),
                },
            ],
        };

        const mappedTicket = mapTicketForResponse(ticket);

        assert.equal(
            mappedTicket.attachments[0].url,
            `/api/tickets/${ticketId}/attachments/${initialAttachmentId}/stream`,
            'Initial creation attachment should link to the ticket attachment stream.',
        );

        const [firstReply, secondReply, thirdReply] = mappedTicket.activityLog;

        assert.equal(firstReply.attachments.length, 0, 'Replies without uploads should not gain attachments.');

        assert.equal(secondReply.attachments.length, 2, 'Reply with two uploads should expose both attachments.');
        assert.deepEqual(
            secondReply.attachments.map((item) => item.id),
            [replyAttachmentId.toString(), replyPdfAttachmentId.toString()],
            'Second reply should only include its own image and PDF attachments.',
        );
        secondReply.attachments.forEach((attachment) => {
            assert.match(
                attachment.url,
                new RegExp(`/api/tickets/${ticketId}/attachments/${attachment.id}/stream$`),
                'Attachment URL should reference the same ticket and its own attachment id.',
            );
        });

        assert.equal(thirdReply.attachments.length, 1, 'Later reply should retain only its single attachment.');
        assert.equal(
            thirdReply.attachments[0].id,
            laterAttachmentId.toString(),
            'Third reply should not inherit attachments from earlier replies.',
        );
        assert.match(
            thirdReply.attachments[0].url,
            new RegExp(`/api/tickets/${ticketId}/attachments/${laterAttachmentId}/stream$`),
            'Later reply attachment URL should also reference its own id under the same ticket.',
        );

        const allActivityAttachmentIds = mappedTicket.activityLog.flatMap((entry) =>
            entry.attachments.map((attachment) => attachment.id),
        );
        assert.deepEqual(
            allActivityAttachmentIds,
            [replyAttachmentId.toString(), replyPdfAttachmentId.toString(), laterAttachmentId.toString()],
            'Only reply uploads should appear in activity log attachments and must stay tied to their comments.',
        );
    });
});
