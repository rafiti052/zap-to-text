#!/usr/bin/env bash
# beforeReadFile — deny reading .env / .env.* (except .env.example)
set -euo pipefail
HOOK_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=env-guard.sh
source "$HOOK_DIR/env-guard.sh"

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.file_path // .path // empty')
base=$(basename -- "$file_path")

if is_protected_env_basename "$base"; then
  deny_json "Blocked: agents cannot read .env files ($base)."
  exit 0
fi

allow_json
exit 0
