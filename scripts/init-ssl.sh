#!/bin/bash

# Configuration
domains=(finance.example.com example.com)


rsa_key_size=4096
data_path="./letsencrypt"
www_path="./www"
email="" # Set this to your email or pass it as an argument
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits

# Parse email argument
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --email) email="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$email" ]; then
  echo "Error: Email is required. Usage: ./scripts/init-ssl.sh --email your@email.com"
  exit 1
fi

if [ ! -e "$data_path/options-ssl-nginx.conf" ] || [ ! -e "$data_path/ssl-dhparams.pem" ]; then
  echo "Downloading recommended TLS parameters ..."
  mkdir -p "$data_path"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/ssl-dhparams.pem"
  echo "Downloaded."
fi

echo "### Requesting Let's Encrypt active certificate for ${domains[*]} ..."

# Join domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate flag for staging
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker run --rm \
    -v "$PWD/letsencrypt:/etc/letsencrypt" \
    -v "$PWD/www:/var/www/html" \
    certbot/certbot \
    certonly --webroot -w /var/www/html \
    $staging_arg \
    $domain_args \
    --email $email \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal \
    --non-interactive

echo "### Reloading nginx ..."
docker exec edge-nginx nginx -s reload
