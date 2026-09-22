#!/usr/bin/env bash
# Deny shell commands that open .env as a file path (not .env.example).
# Only matches path-like tokens, so agent scripts mentioning the name in comments/regex are ok.
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.command // empty')
scrubbed=$(printf '%s' "$command" | sed 's/\.env\.example//g')

# Path token: start / whitespace / quote / = then optional ./ ../ and ".env" then end or delimiter
if printf '%s' "$scrubbed" | grep -Eq '(^|[[:space:]"'\''`=])(\.\.?/)*\.env($|[[:space:]"'\''`;|&<>])'; then
  jq -n \
    --arg msg 'Blocked: agents cannot read .env via shell.' \
    '{permission: "deny", user_message: $msg, agent_message: $msg}'
  exit 0
fi

echo '{"permission":"allow"}'
exit 0
