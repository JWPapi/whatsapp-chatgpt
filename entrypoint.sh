#!/bin/bash
set -e

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Fix ownership of mounted volumes (runs as root initially)
echo "Setting up permissions..."
chown -R botuser:botuser /app/.wwebjs_auth 2>/dev/null || true

# Clean up stale Chromium lock files to prevent "profile in use" errors
echo "Cleaning up stale lock files..."
find /app/.wwebjs_auth -name "SingletonLock" -delete 2>/dev/null || true
find /app/.wwebjs_auth -name "SingletonCookie" -delete 2>/dev/null || true
find /app/.wwebjs_auth -name "SingletonSocket" -delete 2>/dev/null || true
find /app/.wwebjs_auth -name "lockfile" -delete 2>/dev/null || true

# Start the bot as botuser
cd /app
exec gosu botuser pnpm start
