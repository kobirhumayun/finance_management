#!/bin/bash
set -e

# If the command is "schedule", we set up the cron job
if [ "$1" = "schedule" ]; then
    echo "Starting Backup Scheduler..."
    
    # Default schedule: Run at 03:00 every day
    CRON_SCHEDULE=${BACKUP_CRON_SCHEDULE:-"0 3 * * *"}
    
    echo "Schedule: $CRON_SCHEDULE"
    
    # Create crontab file
    # We need to export environment variables so the cron job can see them
    printenv | grep -v "no_proxy" >> /etc/environment
    
    # Add the cron job
    echo "$CRON_SCHEDULE /backup.sh >> /var/log/cron.log 2>&1" > /etc/crontabs/root
    
    # Start cron in foreground
    # -f: Foreground
    # -d 8: Log level 8 (default)
    exec crond -f -d 8
else
    # If arguments are passed (e.g. manual run), execute them
    # If no arguments, just run the backup script once
    if [ $# -eq 0 ]; then
        exec /backup.sh
    else
        exec "$@"
    fi
fi