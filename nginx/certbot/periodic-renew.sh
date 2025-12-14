#!/bin/sh

# Initial sleep to ensure nginx has started and initial certs might be present
echo "Starting periodic renewal script..."

while :; do
    echo "Running certbot renew..."
    # --deploy-hook runs the command ONLY if the renewal was successful
    certbot renew --deploy-hook "docker exec edge-nginx nginx -s reload"
    
    # Sleep for 12 hours
    echo "Sleeping for 12 hours..."
    sleep 12h & wait $!
done
