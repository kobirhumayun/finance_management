FROM mongo:7.0

# Install dependencies (mongo image already ships with modern database tools that support --nsInclude)
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        restic \
        openssh-client \
        bash \
        dos2unix \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /data

# Copy BOTH scripts
COPY entrypoint.sh /entrypoint.sh
COPY restore.sh /restore.sh

# Fix line endings and permissions for BOTH scripts
RUN dos2unix /entrypoint.sh /restore.sh && \
    chmod +x /entrypoint.sh /restore.sh

# Default is still backup
ENTRYPOINT ["/entrypoint.sh"]