#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

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
const standaloneServer = resolve(__dirname, '..', '.next', 'standalone', 'server.js');

if (!existsSync(standaloneServer)) {
  throw new Error(
    'Standalone server entry not found. Did you forget to run "npm run build" before starting?',
  );
}

const result = spawnSync(process.execPath, [standaloneServer, ...passthroughArgs], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
