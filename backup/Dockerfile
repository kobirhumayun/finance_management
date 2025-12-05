FROM alpine:latest

# Install dependencies
RUN apk add --no-cache restic mongodb-tools openssh-client bash dos2unix

WORKDIR /data

# Copy scripts
COPY entrypoint.sh /entrypoint.sh
COPY restore.sh /restore.sh
COPY backup.sh /backup.sh

# Fix line endings and permissions
RUN dos2unix /entrypoint.sh /restore.sh /backup.sh && \
    chmod +x /entrypoint.sh /restore.sh /backup.sh

# Default is still backup
ENTRYPOINT ["/entrypoint.sh"]