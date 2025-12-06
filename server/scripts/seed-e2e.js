#!/usr/bin/env node
const path = require('path');
const mongoose = require('mongoose');
const { Queue } = require('bullmq');
const dotenv = require('dotenv');

const connectDB = require('../config/database');
const Plan = require('../models/Plan');
const Project = require('../models/Project');
const User = require('../models/User');
const { getPdfQueueConnection, getPdfQueueName } = require('../services/pdfQueue');
const fixtures = require('./fixtures/e2e-data');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const ensureAllowed = () => {
  if (process.env.ALLOW_E2E_SEED !== 'true') {
    throw new Error('Refusing to reset data: set ALLOW_E2E_SEED=true to enable destructive seeding.');
  }
};

const clearDatabase = async () => {
  await mongoose.connection.dropDatabase();
  console.log('MongoDB database dropped.');
};

const seedPlans = async () => {
  const planDocs = await Plan.insertMany(fixtures.plans, { ordered: true });
  const planBySlug = new Map(planDocs.map((plan) => [plan.slug, plan]));
  console.log(`Inserted ${planDocs.length} plan(s).`);
  return planBySlug;
};

const seedUsers = async (planBySlug) => {
  const userDocs = [];

  for (const user of fixtures.users) {
    const planId = planBySlug.get(user.planSlug)?._id;

    if (!planId) {
      throw new Error(`Missing plan for slug ${user.planSlug} while seeding users.`);
    }

    const doc = new User({ ...user, planId });
    await doc.save();
    userDocs.push(doc);
  }

  console.log(`Inserted ${userDocs.length} user(s).`);
  return userDocs;
};

const seedProjects = async (users) => {
  const userByUsername = new Map(users.map((user) => [user.username, user]));
  const projectsWithOwners = fixtures.projects.map((project) => ({
    ...project,
    user_id: userByUsername.get(project.ownerUsername)?._id,
  }));

  const invalidProject = projectsWithOwners.find((project) => !project.user_id);
  if (invalidProject) {
    throw new Error(`Missing user for project owner ${invalidProject.ownerUsername}.`);
  }

  const createdProjects = await Project.insertMany(projectsWithOwners);
  console.log(`Inserted ${createdProjects.length} project(s).`);
};

const resetQueues = async () => {
  const queue = new Queue(getPdfQueueName(), { connection: getPdfQueueConnection() });

  try {
    await queue.waitUntilReady();
    await queue.obliterate({ force: true });
    console.log('Cleared BullMQ queues.');
  } finally {
    await queue.close();
  }
};

(async () => {
  try {
    ensureAllowed();
    await connectDB();
    await clearDatabase();

    const planBySlug = await seedPlans();
    const users = await seedUsers(planBySlug);
    await seedProjects(users);
    await resetQueues();

    await mongoose.connection.close();

    console.log('E2E fixtures applied successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to apply E2E fixtures:', error);
    process.exit(1);
  }
})();
