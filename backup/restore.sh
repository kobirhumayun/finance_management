#!/bin/bash
set -e

echo "======================================================="
echo "      ⚠  STARTING AUTOMATED SYSTEM RESTORE  ⚠"
echo "  This will DELETE existing data and replace it with"
echo "            the latest backup snapshot."
echo "======================================================="

# 1. Configuration & Argument Parsing

# Default values from environment variables
SOURCE_DB="${RESTORE_SOURCE_DB:-finance_management}"
TARGET_DB="${RESTORE_TARGET_DB:-$MONGO_DB_NAME}"

# Allow overriding via command line arguments: ./restore.sh <source_db> <target_db>
if [ -n "$1" ]; then
    SOURCE_DB="$1"
fi
if [ -n "$2" ]; then
    TARGET_DB="$2"
fi

# Validation
if [ -z "$TARGET_DB" ]; then
    echo "Error: Target database name is not set."
    echo "Please set MONGO_DB_NAME or RESTORE_TARGET_DB in environment, or pass as 2nd argument."
    exit 1
fi

echo "Configuration:"
echo "  Source Database (in backup): $SOURCE_DB"
echo "  Target Database (restore to): $TARGET_DB"

# Safety mechanism: Wait 5 seconds to allow abort (Ctrl+C)
echo "Starting in 5 seconds... (Press Ctrl+C to cancel)"
sleep 5

# 2. Pull Files from Restic
echo "--> Step 1: Fetching latest snapshot from Restic..."
# We clean the temp folder first just in case
rm -rf /tmp/restore
restic restore latest --target /tmp/restore

# 3. Restore Database
echo "--> Step 2: Restoring Database..."
# Find the archive file automatically
ARCHIVE_FILE=$(find /tmp/restore -name "mongo_dump_*.archive" | head -n 1)

if [ -z "$ARCHIVE_FILE" ]; then
    echo "Error: No MongoDB dump file found in the latest snapshot!"
    exit 1
fi

echo "Restoring from archive: $ARCHIVE_FILE"

mongorestore \
    --uri="$MONGO_URI" \
    --drop \
    --archive="$ARCHIVE_FILE" \
    --nsInclude="${SOURCE_DB}.*" \
    --nsFrom="${SOURCE_DB}.*" \
    --nsTo="${TARGET_DB}.*"

# 4. Restore Uploads
echo "--> Step 3: Restoring User Uploads..."
# Overwrite live files with restored files
cp -r /tmp/restore/data/uploads/* /data/uploads/

# 5. Cleanup
echo "--> Step 4: Cleaning up temporary files..."
rm -rf /tmp/restore

echo "======================================================="
echo "   ✅  RESTORE COMPLETED SUCCESSFULLY"
echo "======================================================="