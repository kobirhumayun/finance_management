const { describe, test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

describe('ticketController addComment', () => {
    let ticketController;
    let req;
    let res;
    let next;
    let mockTicket;
    let mockUser;
    let notifyTicketParticipantsMock;
    let originalNotificationService;

    const notificationServicePath = require.resolve('../services/ticketNotificationService');
    const coreNotificationServicePath = require.resolve('../services/notificationService');
    const imageServicePath = require.resolve('../services/imageService');
    const userModelPath = require.resolve('../models/User');
    const ticketModelPath = require.resolve('../models/Ticket');
    const storageStreamerPath = require.resolve('../utils/storageStreamer');
    const ticketControllerPath = require.resolve('../controllers/ticketController');

    const mockInCache = (modulePath, exports) => {
        const mockModule = {
            id: modulePath,
            filename: modulePath,
            loaded: true,
            exports: exports,
        };
        require.cache[modulePath] = mockModule;

        // Also mock the lowercase drive letter version just in case
        const lowerPath = modulePath.replace(/^[A-Z]:/, (match) => match.toLowerCase());
        if (lowerPath !== modulePath) {
            require.cache[lowerPath] = mockModule;
        }

        // Also mock the uppercase drive letter version just in case
        const upperPath = modulePath.replace(/^[a-z]:/, (match) => match.toUpperCase());
        if (upperPath !== modulePath) {
            require.cache[upperPath] = mockModule;
        }
    };

    const deleteFromCache = (modulePath) => {
        delete require.cache[modulePath];
        const lowerPath = modulePath.replace(/^[A-Z]:/, (match) => match.toLowerCase());
        if (lowerPath !== modulePath) delete require.cache[lowerPath];
        const upperPath = modulePath.replace(/^[a-z]:/, (match) => match.toUpperCase());
        if (upperPath !== modulePath) delete require.cache[upperPath];
    };

    beforeEach(() => {
        // Clear caches
        deleteFromCache(ticketControllerPath);
        deleteFromCache(notificationServicePath);
        deleteFromCache(coreNotificationServicePath);
        deleteFromCache(imageServicePath);
        deleteFromCache(userModelPath);
        deleteFromCache(ticketModelPath);
        deleteFromCache(storageStreamerPath);

        // Setup Mocks
        mockUser = {
            _id: 'user-123',
            firstName: 'Test',
            email: 'test@example.com',
        };

        mockTicket = {
            _id: 'ticket-456',
            subject: 'Test Ticket',
            requester: 'user-123',
            assignee: 'support-789',
            activityLog: [],
            attachments: [],
            save: async () => { },
            toObject: () => mockTicket,
        };

        req = {
            params: { ticketId: 'ticket-456' },
            body: { comment: 'This is a test comment' },
            user: mockUser,
            ticket: mockTicket,
            files: [],
        };

        res = {
            status: (code) => ({
                json: (data) => {
                    res.statusCode = code;
                    res.body = data;
                },
            }),
        };

        next = (error) => {
            throw error;
        };

        notifyTicketParticipantsMock = mock.fn(async () => true);

        // Mock User Model in Cache
        const mockUserModel = {
            find: async () => [mockUser],
            findById: async () => mockUser,
        };
        mockInCache(userModelPath, mockUserModel);

        // Mock Ticket Model in Cache
        const mockTicketModel = function () { return mockTicket; };
        mockTicketModel.find = async () => [mockTicket];
        mockTicketModel.countDocuments = async () => 1;
        mockInCache(ticketModelPath, mockTicketModel);

        // Mock Core Notification Service in Cache
        mockInCache(coreNotificationServicePath, {
            sendNotification: async () => { },
        });

        // Mock Image Service in Cache
        mockInCache(imageServicePath, {
            getUploadFileSizeLimit: () => 1024,
            saveTicketAttachment: async () => ({}),
            discardDescriptor: async () => { },
        });

        // Mock Storage Streamer in Cache
        mockInCache(storageStreamerPath, {
            streamStoredFile: async () => { },
        });

        // Mock TicketNotificationService
        const notificationService = require(notificationServicePath);
        originalNotificationService = { ...notificationService };
        notificationService.notifyTicketParticipants = notifyTicketParticipantsMock;
        notificationService.formatUserName = () => 'Test User';
        notificationService.getUserNameById = () => 'Test User';

        // Re-require controller
        ticketController = require(ticketControllerPath);
    });

    afterEach(() => {
        // Restore Notification Service
        const notificationService = require(notificationServicePath);
        Object.assign(notificationService, originalNotificationService);

        // Clear caches
        deleteFromCache(userModelPath);
        deleteFromCache(ticketModelPath);
        deleteFromCache(ticketControllerPath);
        deleteFromCache(notificationServicePath);
        deleteFromCache(coreNotificationServicePath);
        deleteFromCache(imageServicePath);
        deleteFromCache(storageStreamerPath);

        mock.reset();
    });

    test('should call notifyTicketParticipants with correct arguments', async () => {
        await ticketController.addComment(req, res, next);

        assert.equal(res.statusCode, 200);
        assert.equal(notifyTicketParticipantsMock.mock.calls.length, 1);

        const args = notifyTicketParticipantsMock.mock.calls[0].arguments[0];
        assert.equal(args.ticket, mockTicket);
        assert.match(args.subject, /New response on ticket/);
        assert.match(args.text, /This is a test comment/);
        assert.equal(args.excludeUserId, mockUser._id);
    });

    test('should not send notification if comment is empty and no files', async () => {
        req.body.comment = '';

        await ticketController.addComment(req, res, next);

        assert.equal(res.statusCode, 400);
        assert.equal(notifyTicketParticipantsMock.mock.calls.length, 0);
    });
});
