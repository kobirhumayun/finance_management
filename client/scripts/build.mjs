#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

process.env.NEXT_FORCE_WEBPACK = '1';
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const nextBin = resolve(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');

const result = spawnSync(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
