#!/usr/bin/env bash
# beforeShellExecution — deny shells that touch .env (incl. concat bypasses)
set -euo pipefail
HOOK_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=env-guard.sh
source "$HOOK_DIR/env-guard.sh"

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.command // empty')

if mentions_protected_env "$command"; then
  deny_json "Blocked: agents cannot access .env via shell (including path-construction bypasses)."
  exit 0
fi

allow_json
exit 0
