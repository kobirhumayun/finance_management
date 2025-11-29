# backup/Dockerfile
FROM alpine:latest

# Install Restic, MongoDB Tools, and SSH (for SFTP)
RUN apk add --no-cache restic mongodb-tools openssh-client bash

# Create backup directory
WORKDIR /data

# Add the backup script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]