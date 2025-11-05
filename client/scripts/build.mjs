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

const nextArgs = (() => {
  const args = [...rawArgs];

  const consumeAt = (index, count = 1) => {
    if (index >= 0) {
      args.splice(index, count);
    }
  };

  const environmentFlagIndex = args.findIndex((arg) =>
    arg.startsWith('--environment='),
  );

  if (environmentFlagIndex !== -1) {
    const [, value] = args[environmentFlagIndex].split('=');
    if (value) {
      process.env.NODE_ENV = value;
    }
    consumeAt(environmentFlagIndex);
  } else {
    const environmentIndex = args.findIndex((arg) => arg === '--environment');
    if (environmentIndex !== -1) {
      const value = args[environmentIndex + 1];
      if (value) {
        process.env.NODE_ENV = value;
        consumeAt(environmentIndex, 2);
      } else {
        consumeAt(environmentIndex);
      }
    }
  }

  const developmentIndex = args.findIndex(
    (arg) => arg === '--development' || arg === '--dev',
  );

  if (developmentIndex !== -1) {
    process.env.NODE_ENV = 'development';
    consumeAt(developmentIndex);
  }

  return args;
})();

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

const result = spawnSync(process.execPath, [nextBin, 'build', ...nextArgs], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
