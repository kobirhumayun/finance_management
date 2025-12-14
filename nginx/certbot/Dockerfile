FROM certbot/certbot:v2.11.0

# Install docker-cli so we can reload nginx from this container
# We are using alpine based certbot image
RUN apk add --no-cache docker-cli

# Copy renewal script
COPY periodic-renew.sh /periodic-renew.sh
RUN chmod +x /periodic-renew.sh

ENTRYPOINT ["/periodic-renew.sh"]
