#!/bin/bash
set -e

if [ -z "$MONGO_URI" ]; then
    echo "Error: MONGO_URI is not set."
    exit 1
fi

if [ -z "$MONGO_DB" ]; then
    echo "Error: MONGO_DB is not set."
    exit 1
fi

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DUMP_FILE="/data/dump/mongo_dump_${TIMESTAMP}.archive"

echo "--- Starting Backup Job at ${TIMESTAMP} ---"

# 1. Dump MongoDB
echo "Step 1: Creating MongoDB Dump..."
mkdir -p /data/dump

DUMP_ARGS=(--uri="$MONGO_URI" --db="$MONGO_DB" --archive="$DUMP_FILE")

if [ -n "$MONGODUMP_EXTRA_ARGS" ]; then
    # shellcheck disable=SC2206
    DUMP_ARGS+=( $MONGODUMP_EXTRA_ARGS )
fi

mongodump "${DUMP_ARGS[@]}"

# 2. Initialize Restic Repo (if it doesn't exist)
if ! restic snapshots > /dev/null 2>&1; then
    echo "Restic repository not initialized. Initializing..."
    restic init
fi

# 3. Perform Backup (Chunk-based & Deduplicated)
echo "Step 2: Pushing to Restic Repository..."
restic backup \
    --verbose \
    "$DUMP_FILE" \
    /data/uploads \
    --tag "production-backup"

# 4. Cleanup Dump File
rm "$DUMP_FILE"

# 5. Prune Old Snapshots (Retention Policy)
echo "Step 3: Pruning old snapshots..."
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune

echo "--- Backup Success ---"
