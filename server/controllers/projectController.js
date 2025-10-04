const mongoose = require('mongoose');
const Project = require('../models/Project');
const Transaction = require('../models/Transaction');

const { Types } = mongoose;

const isValidObjectId = (value) => Types.ObjectId.isValid(value);

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mapProject = (project) => ({
    id: project._id.toString(),
    name: project.name,
    description: project.description || '',
    currency: project.currency,
    createdAt: toResponseDate(project.createdAt),
    updatedAt: project.updatedAt ? project.updatedAt.toISOString() : null,
});

const toResponseDate = (date) => {
    if (!date) {
        return null;
    }
    try {
        return date.toISOString().slice(0, 10);
    } catch (error) {
        return null;
    }
};

const mapTransaction = (transaction) => ({
    id: transaction._id.toString(),
    projectId: transaction.project_id.toString(),
    date: toResponseDate(transaction.transaction_date),
    type: transaction.type === 'cash_out' ? 'Expense' : 'Income',
    amount: transaction.amount,
    subcategory: transaction.subcategory,
    description: transaction.description || '',
    createdAt: transaction.createdAt ? transaction.createdAt.toISOString() : null,
    updatedAt: transaction.updatedAt ? transaction.updatedAt.toISOString() : null,
});

const ensureProjectOwnership = async (projectId, userId) => {
    if (!isValidObjectId(projectId)) {
        return null;
    }

    const project = await Project.findOne({ _id: projectId, user_id: userId });
    return project;
};

const getProjects = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { search, sort } = req.query;

        const query = { user_id: userId };
        if (search && typeof search === 'string') {
            query.name = { $regex: new RegExp(escapeRegex(search.trim()), 'i') };
        }

        const sortDirection = sort === 'oldest' ? 1 : -1;
        const projects = await Project.find(query)
            .sort({ createdAt: sortDirection })
            .lean();

        res.status(200).json({
            projects: projects.map(mapProject),
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

        const project = await ensureProjectOwnership(projectId, userId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const transactions = await Transaction.find({ project_id: project._id, user_id: userId })
            .sort({ transaction_date: -1, createdAt: -1 })
            .lean();

        res.status(200).json({
            project: mapProject(project),
            transactions: transactions.map(mapTransaction),
        });
    } catch (error) {
        next(error);
    }
};

const toStorageType = (type) => {
    if (type === 'income') {
        return 'cash_in';
    }
    if (type === 'expense') {
        return 'cash_out';
    }
    return null;
};

const parseTransactionDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
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

module.exports = {
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
};
