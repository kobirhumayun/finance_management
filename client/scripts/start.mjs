#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;

process.env.NODE_ENV ??= 'production';
process.env.NEXT_FORCE_WEBPACK = '1';
delete process.env.NEXT_USE_TURBOPACK;
delete process.env.NEXT_TURBOPACK_USE_WORKER;

const rawArgs = process.argv.slice(2);
const hostnameArgPatterns = ['--hostname', '-H'];

let hostnameFromArgs;
const passthroughArgs = [];

for (let idx = 0; idx < rawArgs.length; idx += 1) {
  const arg = rawArgs[idx];

  if (hostnameArgPatterns.includes(arg)) {
    hostnameFromArgs = rawArgs[idx + 1];
    idx += 1;
    continue;
  }

  const equalsPattern = hostnameArgPatterns.find((pattern) => arg.startsWith(`${pattern}=`));
  if (equalsPattern) {
    hostnameFromArgs = arg.slice(equalsPattern.length + 1);
    continue;
  }

  passthroughArgs.push(arg);
}

const hostname = hostnameFromArgs ?? process.env.HOST ?? '0.0.0.0';
process.env.HOST = hostname;
process.env.HOSTNAME ??= hostname;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
// The standalone server doesn't automatically load env files, so emulate Next CLI
// by hydrating process.env from .env*, ensuring secrets like NEXTAUTH_SECRET exist.
loadEnvConfig(projectRoot, false);
const workspaceRoot = resolve(projectRoot, '..');
const standaloneDir = resolve(projectRoot, '.next', 'standalone');
const projectRelativePath = relative(workspaceRoot, projectRoot);

const standaloneCandidates = [resolve(standaloneDir, 'server.js')];

if (projectRelativePath && !projectRelativePath.startsWith('..')) {
  standaloneCandidates.push(resolve(standaloneDir, projectRelativePath, 'server.js'));
}

const standaloneServer = standaloneCandidates.find((candidate) => existsSync(candidate));

if (!standaloneServer) {
  throw new Error(
    'Standalone server entry not found. Did you forget to run "npm run build" before starting?',
  );
}

function syncDirectory(source, destination) {
  if (!existsSync(source)) {
    return false;
  }

  const resolvedSource = resolve(source);
  const resolvedDestination = resolve(destination);

  if (resolvedSource === resolvedDestination) {
    return true;
  }

  mkdirSync(dirname(resolvedDestination), { recursive: true });
  rmSync(resolvedDestination, { recursive: true, force: true });
  cpSync(resolvedSource, resolvedDestination, { recursive: true });
  return true;
}

function ensureStandaloneAssets(standaloneServerPath) {
  const standaloneServerDir = dirname(standaloneServerPath);
  const projectStaticDir = resolve(projectRoot, '.next', 'static');
  const standaloneStaticDir = resolve(standaloneServerDir, '.next', 'static');
  const projectPublicDir = resolve(projectRoot, 'public');
  const standalonePublicDir = resolve(standaloneServerDir, 'public');

  const copiedStatic = syncDirectory(projectStaticDir, standaloneStaticDir);
  if (!copiedStatic) {
    throw new Error('Missing .next/static directory. Did the build step complete successfully?');
  }

  syncDirectory(projectPublicDir, standalonePublicDir);
}

ensureStandaloneAssets(standaloneServer);

const result = spawnSync(process.execPath, [standaloneServer, ...passthroughArgs], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
