#!/usr/bin/env bash
# Shared helpers for .env protection hooks.
# Allow: .env.example (and paths ending with that name)
# Deny: .env and .env.<anything else>

is_env_example() {
  local base="$1"
  [[ "$base" == ".env.example" ]]
}

# True if basename is a protected env file
is_protected_env_basename() {
  local base="$1"
  if is_env_example "$base"; then
    return 1
  fi
  [[ "$base" == ".env" || "$base" == .env.* ]]
}

# Normalize common agent bypasses that build ".env" without a contiguous token
normalize_env_bypasses() {
  local s="$1"
  # Unescape quotes so \"env\" matches the same as "env"
  s=$(printf '%s' "$s" | sed -e 's/\\"/"/g' -e "s/\\\\'/'/g")
  # '.' + 'env' / "." + "env" / chr(46)+"env" / ['.','env']
  s=$(printf '%s' "$s" | sed -E \
    -e "s/['\"]\.['\"][[:space:]]*\+[[:space:]]*['\"]env['\"]/\.env/g" \
    -e "s/['\"]\.['\"][[:space:]]*\+[[:space:]]*['\"]env\./\.env./g" \
    -e "s/\.[[:space:]]*\+[[:space:]]*['\"]env['\"]/\.env/g" \
    -e "s/\.[[:space:]]*\+[[:space:]]*['\"]env\./\.env./g" \
    -e "s/chr\(46\)[[:space:]]*\+[[:space:]]*['\"]env['\"]/\.env/g" \
    -e "s/chr\(46\)[[:space:]]*\+[[:space:]]*['\"]env\./\.env./g" \
    -e "s/chr\(46\)[[:space:]]*\+[[:space:]]*chr\(101\)[[:space:]]*\+[[:space:]]*chr\(110\)[[:space:]]*\+[[:space:]]*chr\(118\)/\.env/g" \
    -e "s/\[[[:space:]]*['\"]\.['\"][[:space:]]*,[[:space:]]*['\"]env['\"][[:space:]]*\]/\.env/g")
  printf '%s' "$s"
}

# After removing .env.example mentions, does text still refer to a protected .env path?
mentions_protected_env() {
  local s="$1"
  local scrubbed
  scrubbed=$(printf '%s' "$s" | sed 's/\.env\.example//g')
  scrubbed=$(normalize_env_bypasses "$scrubbed")
  scrubbed=$(printf '%s' "$scrubbed" | sed 's/\.env\.example//g')
  printf '%s' "$scrubbed" | grep -q '\.env'
}

deny_json() {
  local msg="$1"
  jq -n --arg msg "$msg" \
    '{permission: "deny", user_message: $msg, agent_message: $msg}'
}

allow_json() {
  echo '{"permission":"allow"}'
}
