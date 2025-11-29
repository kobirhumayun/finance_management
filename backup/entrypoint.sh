#!/bin/bash
set -e

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DUMP_FILE="/data/dump/mongo_dump_${TIMESTAMP}.archive"

echo "--- Starting Backup Job at ${TIMESTAMP} ---"

# 1. Dump MongoDB
# We connect to the 'finance-management-db' service defined in docker-compose
echo "Step 1: Creating MongoDB Dump..."
mkdir -p /data/dump
mongodump --uri="$MONGO_URI" --archive="$DUMP_FILE"

# 2. Restic Backup
# We verify the repo exists, initializing it if this is the first run
if ! restic snapshots > /dev/null 2>&1; then
    echo "Restic repository not initialized. Initializing..."
    restic init
fi

echo "Step 2: Pushing to Restic Repository..."
# We backup the DB dump AND the uploads volume mounted at /data/uploads
restic backup \
    --verbose \
    "$DUMP_FILE" \
    /data/uploads \
    --tag "docker-backup"

# 3. Cleanup Local Dump (Restic has it now)
rm "$DUMP_FILE"

# 4. Prune Old Backups (Optional automation)
echo "Step 3: Pruning old snapshots..."
restic forget --keep-daily 7 --keep-weekly 4 --prune

echo "--- Backup Success ---"