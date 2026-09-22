#!/usr/bin/env bash
# Local self-test for env-guard (run: bash .cursor/hooks/selftest.sh)
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=env-guard.sh
source .cursor/hooks/env-guard.sh

fail=0
check() {
  local name="$1" want="$2"  # want = deny|allow
  shift 2
  if "$@"; then
    got=deny
  else
    got=allow
  fi
  if [[ "$got" == "$want" ]]; then
    echo "OK $name"
  else
    echo "FAIL $name (got $got want $want)"
    fail=1
  fi
}

# mentions_protected_env returns 0 (true) when DENY
check concat deny mentions_protected_env 'p=("."+"env"); open(p)'
check compose deny mentions_protected_env 'docker compose --env-file .env up'
check chr deny mentions_protected_env 'open(chr(46)+"env")'
check other allow mentions_protected_env 'cat ./readme.md'
check example allow mentions_protected_env 'cp .env.example ./tmp'

check base_env deny is_protected_env_basename '.env'
check base_local deny is_protected_env_basename '.env.local'
check base_ex allow is_protected_env_basename '.env.example'

# Hook scripts via stdin
out=$(printf '%s' '{"file_path":"/tmp/.env"}' | bash .cursor/hooks/block-env.sh)
echo "$out" | grep -q '"deny"' && echo OK read_hook || { echo FAIL read_hook; fail=1; }

out=$(printf '%s' '{"file_path":"/tmp/.env.example"}' | bash .cursor/hooks/block-env.sh)
echo "$out" | grep -q '"allow"' && echo OK read_example || { echo FAIL read_example; fail=1; }

# Realistic bypass shapes agents use
for cmd in \
  'python3 -c "p=\".\" + \"env\"; open(p).read()"' \
  'python3 -c "open(chr(46)+\"env\").read()"' \
  'cat ./\.env'
  do
  out=$(jq -n --arg c "$cmd" '{command:$c}' | bash .cursor/hooks/block-env-shell.sh)
  if echo "$out" | grep -q '"deny"'; then
    echo "OK shell_deny: $cmd"
  else
    echo "FAIL shell_deny: $cmd -> $out"
    fail=1
  fi
done

out=$(jq -n --arg c 'docker compose ps' '{command:$c}' | bash .cursor/hooks/block-env-shell.sh)
echo "$out" | grep -q '"allow"' && echo OK shell_allow_ps || { echo FAIL shell_allow_ps; fail=1; }

out=$(printf '%s' '{"tool_input":{"path":"/repo/.env"}}' | bash .cursor/hooks/block-env-write.sh)
echo "$out" | grep -q '"deny"' && echo OK write_hook || { echo FAIL write_hook; fail=1; }

out=$(printf '%s' '{"tool_input":{"path":"/repo/README.md"},"tool_input_contents":"mention .env here"}' | bash .cursor/hooks/block-env-write.sh)
echo "$out" | grep -q '"allow"' && echo OK write_readme || { echo FAIL write_readme; fail=1; }

exit "$fail"
