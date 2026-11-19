#!/bin/bash
# Creates a self-signed TLS certificate for running the API over HTTPS on
# localhost (development only; production uses a certificate from a real CA).
set -e
cd "$(dirname "$0")/../certs"
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout localhost-key.pem -out localhost-cert.pem \
  -subj "/CN=localhost/O=KaiShare Dev" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
chmod 600 localhost-key.pem
echo "Created certs/localhost-key.pem and certs/localhost-cert.pem"
