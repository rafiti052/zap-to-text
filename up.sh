#!/usr/bin/env bash
# Bootstrap / rebuild zap-to-text (single container).
# After this once, the container restarts with Docker Desktop (unless-stopped).
set -euo pipefail
cd "$(dirname "$0")"
docker compose --env-file .env up -d --build "$@"
echo ""
echo "zap-to-text is up. Useful:"
echo "  docker compose logs -f zap-to-text"
echo "  docker compose ps"
echo "  # First run: scan the QR printed in the logs above"
