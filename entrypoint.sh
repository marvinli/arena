#!/bin/sh
set -e

# Start proctor-api in the background
cd /app && node dist/index.js &

# Wait for proctor-api to be ready
echo "Waiting for proctor-api..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:4001/graphql -o /dev/null -X POST -H 'Content-Type: application/json' -d '{"query":"{__typename}"}' 2>/dev/null; then
    echo "proctor-api is ready"
    break
  fi
  sleep 1
done

# Start Nginx in the foreground (PID 1)
nginx -g 'daemon off;'
