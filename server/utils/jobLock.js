const mongoose = require('mongoose');

const jobLockSchema = new mongoose.Schema({
    jobName: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    owner: {
        type: String,
        required: true
    },
    lockedAt: {
        type: Date,
        default: Date.now
    },
    lockedUntil: {
        type: Date,
        required: true
    }
}, {
    collection: 'joblocks',
    timestamps: false
});

jobLockSchema.index({ lockedUntil: 1 }, { expireAfterSeconds: 0 });

const JobLock = mongoose.models.JobLock || mongoose.model('JobLock', jobLockSchema);

const acquireLock = async (jobName, ttlMs, owner) => {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + ttlMs);

    try {
        const lock = await JobLock.findOneAndUpdate(
            {
                jobName,
                $or: [
                    { lockedUntil: { $lte: now } },
                    { lockedUntil: { $exists: false } }
                ]
            },
            {
                $set: {
                    owner,
                    lockedAt: now,
                    lockedUntil
                },
                $setOnInsert: {
                    jobName
                }
            },
            {
                new: true,
                upsert: true
            }
        );

        return lock;
    } catch (error) {
        if (error.code === 11000) {
            return null;
        }
        throw error;
    }
};

const releaseLock = async (jobName, owner) => {
    const result = await JobLock.deleteOne({ jobName, owner });
    return result.deletedCount > 0;
};

module.exports = {
    acquireLock,
    releaseLock
};
