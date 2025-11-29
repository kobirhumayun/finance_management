#!/bin/sh
set -euo pipefail

DUMP_DIR="/tmp/mongo_dump"

# Perform MongoDB dump
mongodump --uri "${MONGO_URI}" --out "${DUMP_DIR}"

# Initialize Restic repository if it has not been initialized yet
if ! restic snapshots >/dev/null 2>&1; then
  restic init
fi

# Backup MongoDB dump and uploads directory
restic backup "${DUMP_DIR}" /data/uploads

# Prune old snapshots
restic forget --prune --keep-daily 7 --keep-weekly 4

# Cleanup dump directory
rm -rf "${DUMP_DIR}"
