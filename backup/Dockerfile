FROM alpine:latest

# Install dependencies
RUN apk add --no-cache restic mongodb-tools openssh-client bash dos2unix

WORKDIR /data

# Copy BOTH scripts
COPY entrypoint.sh /entrypoint.sh
COPY restore.sh /restore.sh

# Fix line endings and permissions for BOTH scripts
RUN dos2unix /entrypoint.sh /restore.sh && \
    chmod +x /entrypoint.sh /restore.sh

# Default is still backup
ENTRYPOINT ["/entrypoint.sh"]