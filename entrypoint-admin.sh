#!/bin/sh
set -e

# Generate runtime config from environment variables
cat > /usr/share/nginx/html/config.js << EOF
window.__ARENA_CONFIG__ = {
  cognitoDomain: "${COGNITO_DOMAIN}",
  cognitoClientId: "${COGNITO_CLIENT_ID}",
};
EOF

# Start admin-api in the background
cd /app && node dist/index.js &

# Start Nginx in the foreground (PID 1)
nginx -g 'daemon off;'
