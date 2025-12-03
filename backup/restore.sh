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

# Ensure required variables exist so operators can add --ns* flags without editing secrets
if [ -z "$MONGO_URI" ]; then
    echo "Error: MONGO_URI is not set."
    exit 1
fi

if [ -z "$MONGO_DB" ]; then
    echo "Error: MONGO_DB is not set."
    exit 1
fi

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

if mongorestore --help | grep -q -- '--nsInclude'; then
    RESTORE_ARGS=(
        --uri="$MONGO_URI"
        --nsInclude="${MONGO_DB}.*"
        --drop
        --archive="$ARCHIVE_FILE"
    )
else
    echo "Warning: mongorestore does not support --nsInclude. Falling back to deprecated --db flag."
    RESTORE_ARGS=(
        --uri="$MONGO_URI"
        --db="$MONGO_DB"
        --drop
        --archive="$ARCHIVE_FILE"
    )
fi

if [ -n "$MONGORESTORE_EXTRA_ARGS" ]; then
    # shellcheck disable=SC2206
    RESTORE_ARGS+=( $MONGORESTORE_EXTRA_ARGS )
fi

mongorestore "${RESTORE_ARGS[@]}"

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
