# Claude Code MCP + secrets wiring

Committed MCP setup so Context7, DeepWiki, and Devin are available in both local
and cloud Claude Code sessions, with no secrets in git.

- `../.mcp.json` — context7/deepwiki/devin remote MCP servers; keys referenced as
  `${CONTEXT7_API_KEY}` / `${DEVIN_API_KEY}`.
- `settings.json` — a `SessionStart` hook running `load-doppler-env.sh`.
- `load-doppler-env.sh` — pulls only the two MCP keys from the Doppler
  `printwithsynergy` project into `$CLAUDE_ENV_FILE`; no-op without `DOPPLER_TOKEN`.

Reliable path: set the keys in the env BEFORE Claude launches — locally
`export DOPPLER_TOKEN=...` + `doppler run -- claude` (or export the keys
directly); in the cloud env set `DOPPLER_TOKEN` (+ optionally the two keys) and
allow `api.doppler.com`, `mcp.context7.com`, `mcp.deepwiki.com`, `mcp.devin.ai`.
The SessionStart hook is best-effort (MCP init runs before it).
