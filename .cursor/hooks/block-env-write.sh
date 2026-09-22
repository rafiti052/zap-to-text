#!/usr/bin/env bash
# preToolUse — deny Write/StrReplace targeting protected env files.
# Only inspects the target path — not file contents (docs may mention secrets files).
set -euo pipefail
HOOK_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=env-guard.sh
source "$HOOK_DIR/env-guard.sh"

input=$(cat)
path=$(printf '%s' "$input" | jq -r '
  .tool_input.path // .tool_input.file_path // .tool_input.target_notebook // .file_path // .path // empty
')
base=$(basename -- "$path")

if [[ -n "$base" ]] && is_protected_env_basename "$base"; then
  deny_json "Blocked: agents cannot write protected env files ($base)."
  exit 0
fi

if [[ -n "$path" ]] && mentions_protected_env "$path"; then
  deny_json "Blocked: agents cannot write protected env files."
  exit 0
fi

allow_json
exit 0
