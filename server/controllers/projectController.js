const Project = require('../models/Project');
const Transaction = require('../models/Transaction');

const {
    clampLimit,
    escapeRegex,
    toObjectIdOrNull,
    isValidObjectId,
    toResponseDate,
    mapTransaction,
    buildTransactionCursorFilter,
    toStorageType,
    parseTransactionDate,
} = require('../utils/transactionQueryHelpers');

const mapProject = (project) => ({
    id: project._id.toString(),
    name: project.name,
    description: project.description || '',
    currency: project.currency,
    createdAt: toResponseDate(project.createdAt),
    updatedAt: project.updatedAt ? project.updatedAt.toISOString() : null,
});

const ensureProjectOwnership = async (projectId, userId) => {
    if (!isValidObjectId(projectId)) {
        return null;
    }

    const project = await Project.findOne({ _id: projectId, user_id: userId });
    return project;
};

const buildCursorFilter = (direction, fieldName, fieldValue, idValue) => {
    if (!fieldValue) {
        return {};
    }

    const comparisonOperator = direction === 1 ? '$gt' : '$lt';
    const equalityOperator = direction === 1 ? '$gt' : '$lt';

    return {
        $or: [
            { [fieldName]: { [comparisonOperator]: fieldValue } },
            {
                [fieldName]: fieldValue,
                _id: { [equalityOperator]: idValue },
            },
        ],
    };
};

const getProjects = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { search, sort, limit: limitParam, cursor } = req.query;

        const baseFilters = [{ user_id: userId }];
        if (search && typeof search === 'string') {
            baseFilters.push({ name: { $regex: new RegExp(escapeRegex(search.trim()), 'i') } });
        }

        const sortDirection = sort === 'oldest' ? 1 : -1;
        const limit = clampLimit(limitParam, { defaultValue: 20 });

        const filters = [...baseFilters];

        if (cursor) {
            if (!isValidObjectId(cursor)) {
                return res.status(400).json({ message: 'Invalid cursor value provided.' });
            }

            const cursorProject = await Project.findOne({ _id: cursor, user_id: userId })
                .select({ createdAt: 1 })
                .lean();

            if (!cursorProject) {
                return res.status(400).json({ message: 'Cursor project could not be found for this user.' });
            }

            filters.push(
                buildCursorFilter(sortDirection, 'createdAt', cursorProject.createdAt, cursorProject._id),
            );
        }

        const query = filters.length > 1 ? { $and: filters } : filters[0];

        const projects = await Project.find(query)
            .sort({ createdAt: sortDirection, _id: sortDirection })
            .limit(limit + 1)
            .lean();

        const hasNextPage = projects.length > limit;
        const trimmedProjects = hasNextPage ? projects.slice(0, -1) : projects;
        const nextCursor = hasNextPage
            ? trimmedProjects[trimmedProjects.length - 1]?._id?.toString() ?? null
            : null;

        const countFilters = cursor ? baseFilters : filters;
        const countQuery = countFilters.length > 1 ? { $and: countFilters } : countFilters[0];
        const totalCount = await Project.countDocuments(countQuery);

        res.status(200).json({
            projects: trimmedProjects.map(mapProject),
            pageInfo: {
                hasNextPage,
                nextCursor,
                limit,
            },
            totalCount,
        });
    } catch (error) {
        next(error);
    }
};

const createProject = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const name = req.body.name.trim();
        const description = (req.body.description || '').trim();
        const currency = (req.body.currency || 'BDT').trim().toUpperCase();

        const duplicate = await Project.findOne({
            user_id: userId,
            name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        });

        if (duplicate) {
            return res.status(409).json({
                message: 'A project with this name already exists.',
            });
        }

        const project = await Project.create({
            user_id: userId,
            name,
            description,
            currency,
        });

        res.status(201).json({ project: mapProject(project) });
    } catch (error) {
        next(error);
    }
};

const updateProject = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { projectId } = req.params;

        if (!isValidObjectId(projectId)) {
            return res.status(400).json({ message: 'Invalid project identifier.' });
        }

        const project = await Project.findOne({ _id: projectId, user_id: userId });

        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const updates = {};
        if (typeof req.body.name === 'string') {
            updates.name = req.body.name.trim();
        }
        if (typeof req.body.description === 'string') {
            updates.description = req.body.description.trim();
        }
        if (typeof req.body.currency === 'string') {
            updates.currency = req.body.currency.trim().toUpperCase();
        }

        if (updates.name && updates.name.toLowerCase() !== project.name.toLowerCase()) {
            const conflict = await Project.findOne({
                _id: { $ne: projectId },
                user_id: userId,
                name: { $regex: new RegExp(`^${escapeRegex(updates.name)}$`, 'i') },
            });
            if (conflict) {
                return res.status(409).json({ message: 'A project with this name already exists.' });
            }
        }

        Object.assign(project, updates);
        await project.save();

        res.status(200).json({ project: mapProject(project) });
    } catch (error) {
        next(error);
    }
};

const deleteProject = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { projectId } = req.params;

        if (!isValidObjectId(projectId)) {
            return res.status(400).json({ message: 'Invalid project identifier.' });
        }

        const project = await Project.findOneAndDelete({ _id: projectId, user_id: userId });

        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        await Transaction.deleteMany({ project_id: project._id, user_id: userId });

        res.status(200).json({
            message: 'Project deleted successfully.',
            projectId: project._id.toString(),
        });
    } catch (error) {
        next(error);
    }
};

const getTransactions = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { projectId } = req.params;
        const {
            limit: limitParam,
            cursor,
            sort,
            type,
            search,
            startDate,
            endDate,
        } = req.query;

        const project = await ensureProjectOwnership(projectId, userId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const userIdentifier = toObjectIdOrNull(userId) ?? userId;
        const filters = [{ project_id: project._id, user_id: userIdentifier }];

        if (type) {
            const storageType = toStorageType(type);
            if (!storageType) {
                return res.status(400).json({ message: 'Invalid transaction type filter provided.' });
            }
            filters.push({ type: storageType });
        }

        if (search) {
            const expression = new RegExp(escapeRegex(search.trim()), 'i');
            filters.push({
                $or: [
                    { description: { $regex: expression } },
                    { subcategory: { $regex: expression } },
                ],
            });
        }

        if (startDate || endDate) {
            const dateFilter = {};
            if (startDate) {
                const parsedStart = parseTransactionDate(startDate);
                if (!parsedStart) {
                    return res.status(400).json({ message: 'Invalid startDate provided.' });
                }
                dateFilter.$gte = parsedStart;
            }
            if (endDate) {
                const parsedEnd = parseTransactionDate(endDate);
                if (!parsedEnd) {
                    return res.status(400).json({ message: 'Invalid endDate provided.' });
                }
                dateFilter.$lte = parsedEnd;
            }

            if (dateFilter.$gte && dateFilter.$lte && dateFilter.$gte > dateFilter.$lte) {
                return res.status(400).json({ message: 'startDate cannot be later than endDate.' });
            }

            filters.push({ transaction_date: dateFilter });
        }

        const limit = clampLimit(limitParam, { defaultValue: 20 });
        const sortDirection = sort === 'oldest' ? 1 : -1;

        if (cursor) {
            if (!isValidObjectId(cursor)) {
                return res.status(400).json({ message: 'Invalid cursor value provided.' });
            }

            const cursorTransaction = await Transaction.findOne({
                _id: cursor,
                project_id: project._id,
                user_id: userId,
            })
                .select({ transaction_date: 1 })
                .lean();

            if (!cursorTransaction) {
                return res.status(400).json({ message: 'Cursor transaction could not be found for this project.' });
            }

            filters.push(buildTransactionCursorFilter(sortDirection, cursorTransaction));
        }

        const query = filters.length > 1 ? { $and: filters } : filters[0];

        const transactions = await Transaction.find(query)
            .sort({ transaction_date: sortDirection, _id: sortDirection })
            .limit(limit + 1)
            .lean();

        const hasNextPage = transactions.length > limit;
        const trimmedTransactions = hasNextPage ? transactions.slice(0, -1) : transactions;
        const nextCursor = hasNextPage
            ? trimmedTransactions[trimmedTransactions.length - 1]?._id?.toString() ?? null
            : null;

        const summaryFilters = cursor ? filters.slice(0, -1) : filters;
        const summaryMatch = summaryFilters.length > 1 ? { $and: summaryFilters } : summaryFilters[0];

        const totals = await Transaction.aggregate([
            {
                $match: summaryMatch,
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const summary = totals.reduce(
            (accumulator, item) => {
                if (item._id === 'cash_in') {
                    accumulator.income += item.total;
                }
                if (item._id === 'cash_out') {
                    accumulator.expense += item.total;
                }
                return accumulator;
            },
            { income: 0, expense: 0 },
        );

        const balance = summary.income - summary.expense;

        res.status(200).json({
            project: mapProject(project),
            transactions: trimmedTransactions.map(mapTransaction),
            summary: {
                income: summary.income,
                expense: summary.expense,
                balance,
            },
            pageInfo: {
                hasNextPage,
                nextCursor,
                limit,
            },
        });
    } catch (error) {
        next(error);
    }
};

const createTransaction = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { projectId } = req.params;

        const project = await ensureProjectOwnership(projectId, userId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const { date, type, amount, subcategory, description } = req.body;
        const transactionDate = parseTransactionDate(date);

        const storageType = toStorageType(type);
        if (!storageType) {
            return res.status(400).json({ message: 'Invalid transaction type provided.' });
        }

        if (!transactionDate) {
            return res.status(400).json({ message: 'Invalid transaction date provided.' });
        }

        const transaction = await Transaction.create({
            project_id: project._id,
            user_id: userId,
            type: storageType,
            amount,
            subcategory: subcategory.trim(),
            description: (description || '').trim(),
            transaction_date: transactionDate,
        });

        res.status(201).json({ transaction: mapTransaction(transaction) });
    } catch (error) {
        next(error);
    }
};

const updateTransaction = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { projectId, transactionId } = req.params;

        if (!isValidObjectId(transactionId)) {
            return res.status(400).json({ message: 'Invalid transaction identifier.' });
        }

        const project = await ensureProjectOwnership(projectId, userId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const transaction = await Transaction.findOne({
            _id: transactionId,
            project_id: project._id,
            user_id: userId,
        });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        if (typeof req.body.type === 'string') {
            const storageType = toStorageType(req.body.type);
            if (!storageType) {
                return res.status(400).json({ message: 'Invalid transaction type provided.' });
            }
            transaction.type = storageType;
        }
        if (typeof req.body.amount === 'number') {
            transaction.amount = req.body.amount;
        }
        if (typeof req.body.subcategory === 'string') {
            transaction.subcategory = req.body.subcategory.trim();
        }
        if (typeof req.body.description === 'string') {
            transaction.description = req.body.description.trim();
        }
        if (typeof req.body.date === 'string') {
            const parsedDate = parseTransactionDate(req.body.date);
            if (!parsedDate) {
                return res.status(400).json({ message: 'Invalid transaction date provided.' });
            }
            transaction.transaction_date = parsedDate;
        }

        await transaction.save();

        res.status(200).json({ transaction: mapTransaction(transaction) });
    } catch (error) {
        next(error);
    }
};

const deleteTransaction = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { projectId, transactionId } = req.params;

        if (!isValidObjectId(transactionId)) {
            return res.status(400).json({ message: 'Invalid transaction identifier.' });
        }

        const project = await ensureProjectOwnership(projectId, userId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const transaction = await Transaction.findOneAndDelete({
            _id: transactionId,
            project_id: project._id,
            user_id: userId,
        });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        res.status(200).json({
            message: 'Transaction deleted successfully.',
            transactionId: transaction._id.toString(),
        });
    } catch (error) {
        next(error);
    }
};

const getProjectById = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { projectId } = req.params;

        if (!isValidObjectId(projectId)) {
            return res.status(400).json({ message: 'Invalid project identifier.' });
        }

        const project = await Project.findOne({ _id: projectId, user_id: userId }).lean();

        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const userIdentifier = toObjectIdOrNull(userId) ?? userId;

        const totals = await Transaction.aggregate([
            {
                $match: {
                    project_id: project._id,
                    user_id: userIdentifier,
                },
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const summary = totals.reduce(
            (accumulator, item) => {
                if (item._id === 'cash_in') {
                    accumulator.income += item.total;
                }
                if (item._id === 'cash_out') {
                    accumulator.expense += item.total;
                }
                return accumulator;
            },
            { income: 0, expense: 0 },
        );

        const balance = summary.income - summary.expense;

        res.status(200).json({
            project: mapProject(project),
            summary: {
                income: summary.income,
                expense: summary.expense,
                balance,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProjectById,
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
};
