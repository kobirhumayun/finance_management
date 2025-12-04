#!/bin/bash
set -e

echo "======================================================="
echo "      ⚠  STARTING AUTOMATED SYSTEM RESTORE  ⚠"
echo "  This will DELETE existing data and replace it with"
echo "            the latest backup snapshot."
echo "======================================================="

# Check if MONGO_DB_NAME is set
if [ -z "$MONGO_DB_NAME" ]; then
    echo "Error: MONGO_DB_NAME is not set in the environment."
    echo "Please add MONGO_DB_NAME=your_db_name to your .env file."
    exit 1
fi

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
# Run a dry run and capture output to a file for debugging
mongorestore --archive="$ARCHIVE_FILE" --dryRun --verbose > /tmp/dryrun.log 2>&1

# Try to find "restoring <db>.<collection>"
# Example line: "2023-10-27T10:00:00.000+0000 restoring my_db.my_collection from archive '...'"
SOURCE_DB=$(grep -oE "restoring [^ ]+\.[^ ]+" /tmp/dryrun.log | head -n 1 | awk '{print $2}' | cut -d. -f1)

if [ -z "$SOURCE_DB" ]; then
    # Fallback 1: Look for "reading metadata for <db>.<collection>"
    SOURCE_DB=$(grep -oE "reading metadata for [^ ]+\.[^ ]+" /tmp/dryrun.log | head -n 1 | awk '{print $4}' | cut -d. -f1)
fi

if [ -z "$SOURCE_DB" ]; then
    # Fallback 2: Look for "restoring users from <db>.users" or similar patterns if format differs
    # Or just look for any "db.collection" pattern that isn't a system one
    SOURCE_DB=$(grep -oE " [a-zA-Z0-9_]+\.[a-zA-Z0-9_]+ " /tmp/dryrun.log | grep -v "admin." | grep -v "local." | grep -v "config." | head -n 1 | awk '{print $1}' | cut -d. -f1)
fi

if [ -z "$SOURCE_DB" ]; then
    echo "Warning: Could not detect source database name from archive."
    echo "--- Start of Dry Run Output ---"
    cat /tmp/dryrun.log
    echo "--- End of Dry Run Output ---"
    
    # Fallback to a default if we can't detect it, to avoid total failure if the user knows what they are doing.
    # We can try to assume it's the same as MONGO_DB_NAME if we are lucky, or 'finance_management' as it's the project default.
    echo "Attempting fallback to default 'finance_management'..."
    SOURCE_DB="finance_management"
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