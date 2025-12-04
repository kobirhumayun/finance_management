#!/bin/bash
set -e

echo "======================================================="
echo "      ⚠  STARTING AUTOMATED SYSTEM RESTORE  ⚠"
echo "  This will DELETE existing data and replace it with"
echo "            the latest backup snapshot."
echo "======================================================="

# Safety mechanism: Wait 5 seconds to allow abort (Ctrl+C)
echo "Starting in 5 seconds... (Press Ctrl+C to cancel)"
sleep 5

# 1. Pull Files from Restic
echo "--> Step 1: Fetching latest snapshot from Restic..."
# We clean the temp folder first just in case
rm -rf /tmp/restore
restic restore latest --target /tmp/restore

# 2. Restore Database
echo "--> Step 2: Restoring Database..."
# Find the archive file automatically
ARCHIVE_FILE=$(find /tmp/restore -name "mongo_dump_*.archive" | head -n 1)

if [ -z "$ARCHIVE_FILE" ]; then
    echo "Error: No MongoDB dump file found in the latest snapshot!"
    exit 1
fi

# Detect the original database name from the archive
echo "--> Detecting original database name..."
# Run a dry run to list namespaces. We capture stderr because mongorestore logs there.
# We look for "restoring <db>.<collection>" lines.
# Example: "restoring finance.users from ..."
SOURCE_DB=$(mongorestore --archive="$ARCHIVE_FILE" --dryRun --verbose 2>&1 | grep -oE "restoring [^ ]+\.[^ ]+" | head -n 1 | awk '{print $2}' | cut -d. -f1)

if [ -z "$SOURCE_DB" ]; then
    echo "Warning: Could not detect source database name. Attempting fallback detection..."
    # Another try: just list the archive content
    SOURCE_DB=$(mongorestore --archive="$ARCHIVE_FILE" --dryRun 2>&1 | grep -m 1 "restoring" | awk '{print $2}' | cut -d. -f1)
fi

if [ -z "$SOURCE_DB" ]; then
    echo "Error: Could not determine source database name from archive. Cannot perform safe rename."
    exit 1
fi

echo "Detected source database: $SOURCE_DB"
echo "Target database: $MONGO_DB_NAME"

mongorestore \
    --uri="$MONGO_URI" \
    --drop \
    --archive="$ARCHIVE_FILE" \
    --nsInclude="${SOURCE_DB}.*" \
    --nsFrom="${SOURCE_DB}.*" \
    --nsTo="${MONGO_DB_NAME}.*"

# 3. Restore Uploads
echo "--> Step 3: Restoring User Uploads..."
# Overwrite live files with restored files
cp -r /tmp/restore/data/uploads/* /data/uploads/

# 4. Cleanup
echo "--> Step 4: Cleaning up temporary files..."
rm -rf /tmp/restore

echo "======================================================="
echo "   ✅  RESTORE COMPLETED SUCCESSFULLY"
echo "======================================================="