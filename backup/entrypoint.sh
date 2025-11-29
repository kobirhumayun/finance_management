#!/bin/sh
set -euo pipefail

: "${MONGO_URI:?MONGO_URI is required}"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"

DUMP_DIR=$(mktemp -d /tmp/mongo_dump.XXXXXX)
UPLOADS_DIR=/data/uploads

cleanup() {
  rm -rf "${DUMP_DIR}"
}
trap cleanup EXIT

# Perform MongoDB dump
mongodump --uri "${MONGO_URI}" --out "${DUMP_DIR}"

# Initialize Restic repository if it has not been initialized yet
if ! restic snapshots >/dev/null 2>&1; then
  restic init
fi

# Backup MongoDB dump and uploads directory
restic backup "${DUMP_DIR}" "${UPLOADS_DIR}"

# Prune old snapshots
restic forget --prune --keep-daily 7 --keep-weekly 4
