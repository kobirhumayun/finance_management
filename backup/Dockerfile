FROM alpine:latest

# Install Restic, Mongo Tools, SSH, Bash, and dos2unix
# dos2unix is critical for Windows-to-Linux compatibility
RUN apk add --no-cache restic mongodb-tools openssh-client bash dos2unix

WORKDIR /data

COPY entrypoint.sh /entrypoint.sh

# 1. Fix Windows line endings (CRLF -> LF)
# 2. Make the script executable
RUN dos2unix /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]