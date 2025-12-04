#!/bin/bash
set -e

echo "======================================================="
echo "      ⚠  STARTING AUTOMATED SYSTEM RESTORE  ⚠"
echo "  This will DELETE existing data and replace it with"
echo "            the selected backup snapshot."
echo "======================================================="

# Default values
SNAPSHOT_ID="latest"
SOURCE_DB="${RESTORE_SOURCE_DB:-finance_management}"
TARGET_DB="${RESTORE_TARGET_DB:-$MONGO_DB_NAME}"

# Function to list snapshots
list_snapshots() {
    echo "--> Fetching available snapshots from Restic..."
    # Initialize repo if needed (though usually it should exist if we are restoring)
    if ! restic snapshots > /dev/null 2>&1; then
        echo "Error: Restic repository not accessible or not initialized."
        exit 1
    fi
    restic snapshots
}

# Parse arguments
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--list)
            list_snapshots
            exit 0
            ;;
        -s|--snapshot)
            SNAPSHOT_ID="$2"
            shift # past argument
            shift # past value
            ;;
        -*|--*)
            echo "Unknown option $1"
            exit 1
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift # past argument
            ;;
    esac
done

set -- "${POSITIONAL_ARGS[@]}" # restore positional parameters

# Handle positional args for DB names (backward compatibility)
if [ -n "$1" ]; then
    SOURCE_DB="$1"
fi
if [ -n "$2" ]; then
    TARGET_DB="$2"
fi

# Validation
if [ -z "$TARGET_DB" ]; then
    echo "Error: Target database name is not set."
    echo "Please set MONGO_DB_NAME or RESTORE_TARGET_DB in environment, or pass as argument."
    exit 1
fi

echo "Configuration:"
echo "  Snapshot ID:     $SNAPSHOT_ID"
echo "  Source Database: $SOURCE_DB"
echo "  Target Database: $TARGET_DB"

# Safety mechanism: Wait 5 seconds to allow abort (Ctrl+C)
echo "Starting in 5 seconds... (Press Ctrl+C to cancel)"
sleep 5

# 1. Pull Files from Restic
echo "--> Step 1: Fetching snapshot '$SNAPSHOT_ID' from Restic..."
# We clean the temp folder first just in case
rm -rf /tmp/restore
restic restore "$SNAPSHOT_ID" --target /tmp/restore

# 2. Restore Database
echo "--> Step 2: Restoring Database..."
# Find the archive file automatically
ARCHIVE_FILE=$(find /tmp/restore -name "mongo_dump_*.archive" | head -n 1)

if [ -z "$ARCHIVE_FILE" ]; then
    echo "Error: No MongoDB dump file found in the snapshot!"
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