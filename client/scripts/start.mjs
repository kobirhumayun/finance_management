#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

process.env.NODE_ENV ??= 'production';
process.env.NEXT_FORCE_WEBPACK = '1';
delete process.env.NEXT_USE_TURBOPACK;
delete process.env.NEXT_TURBOPACK_USE_WORKER;

const rawArgs = process.argv.slice(2);
const hostnameArgPatterns = ['--hostname', '-H'];
const hasHostnameArg = rawArgs.some(
  (arg) =>
    hostnameArgPatterns.includes(arg) ||
    hostnameArgPatterns.some((pattern) => arg.startsWith(`${pattern}=`)),
);

process.env.HOST ??= '0.0.0.0';

const normalizedArgs = hasHostnameArg
  ? rawArgs
  : ['--hostname', process.env.HOST, ...rawArgs];

const __dirname = dirname(fileURLToPath(import.meta.url));
const nextBin = resolve(
  __dirname,
  '..',
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

const result = spawnSync(process.execPath, [nextBin, 'start', ...normalizedArgs], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
