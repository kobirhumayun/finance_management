#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

process.env.NODE_ENV ??= 'production';

const rawArgs = process.argv.slice(2);
const forceWebpackFlag = '--force-webpack';
const disableTurbopackFlag = '--no-turbopack';

const forceWebpack =
  process.env.NEXT_FORCE_WEBPACK === '1' || rawArgs.includes(forceWebpackFlag);
const disableTurbopack = rawArgs.includes(disableTurbopackFlag);

const filteredArgs = rawArgs.filter(
  (arg) => arg !== forceWebpackFlag && arg !== disableTurbopackFlag,
);

if (forceWebpack || disableTurbopack) {
  process.env.NEXT_FORCE_WEBPACK = '1';
  delete process.env.NEXT_USE_TURBOPACK;
} else {
  process.env.NEXT_USE_TURBOPACK = '1';
  if (!filteredArgs.includes('--turbopack')) {
    filteredArgs.push('--turbopack');
  }
}

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

const result = spawnSync(process.execPath, [nextBin, 'build', ...filteredArgs], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
