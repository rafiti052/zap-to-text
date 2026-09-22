#!/usr/bin/env bash
# Bootstrap / rebuild the Baileys bridge (single container).
# After this once, the container restarts with Docker Desktop (unless-stopped).
set -euo pipefail
cd "$(dirname "$0")"
docker compose --env-file .env up -d --build "$@"
echo ""
echo "Bridge up. Useful:"
echo "  docker compose logs -f bridge"
echo "  docker compose ps"
echo "  # First run: scan the QR printed in the logs above"
