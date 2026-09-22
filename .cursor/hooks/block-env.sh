#!/usr/bin/env bash
# Deny agent reads of .env and .env.* files.
set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.file_path // empty')
base=$(basename -- "$file_path")

if [[ "$base" == ".env" || "$base" == .env.* ]]; then
  jq -n \
    --arg msg "Blocked: agents cannot read .env files ($base)." \
    '{permission: "deny", user_message: $msg}'
  exit 0
fi

echo '{"permission":"allow"}'
exit 0
