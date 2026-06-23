#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Load the MCP server credentials from Doppler into the Claude Code session env.
# Runs at SessionStart so committed .mcp.json ${VAR} refs can resolve from one
# source of truth (the Doppler printwithsynergy project). Exports ONLY the keys
# the committed .mcp.json needs (least privilege) — not the whole vault.
# Safe no-op when DOPPLER_TOKEN is unset or Doppler is unreachable.
#
# NOTE: Claude Code initializes MCP servers early in startup, so this hook is
# best-effort for .mcp.json interpolation. For guaranteed resolution also set
# CONTEXT7_API_KEY / DEVIN_API_KEY in the shell (local) or the cloud
# environment's variables (web) before launch — see README.
set -uo pipefail

project="${DOPPLER_PROJECT:-printwithsynergy}"
config="${DOPPLER_CONFIG:-prd}"

# Only the credentials referenced by the committed .mcp.json.
ALLOWED='^(CONTEXT7_API_KEY|DEVIN_API_KEY)='

[ -n "${DOPPLER_TOKEN:-}" ] || exit 0
[ -n "${CLAUDE_ENV_FILE:-}" ] || exit 0

url="https://api.doppler.com/v3/configs/config/secrets/download?project=${project}&config=${config}&format=env-no-quotes"
if ! resp="$(curl -fsS -m 20 -H "Authorization: Bearer ${DOPPLER_TOKEN}" "$url" 2>/dev/null)"; then
  printf 'load-doppler-env: Doppler fetch failed; continuing without injected secrets\n' >&2
  exit 0
fi

# Export only the allowlisted MCP keys, de-duplicated against the env file.
# Stage to a temp file so we never read and append $CLAUDE_ENV_FILE in one pipeline (SC2094).
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
printf '%s\n' "$resp" \
  | grep -E "$ALLOWED" \
  | while IFS= read -r line; do
      key="${line%%=*}"
      grep -q "^${key}=" "$CLAUDE_ENV_FILE" 2>/dev/null || printf '%s\n' "$line"
    done > "$tmp" || true
cat "$tmp" >> "$CLAUDE_ENV_FILE"
