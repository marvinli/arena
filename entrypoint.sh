#!/bin/sh
set -e

# Start proctor-api in the background
cd /app && node dist/index.js &

# Start Nginx in the foreground (PID 1)
nginx -g 'daemon off;'
