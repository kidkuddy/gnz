# Changelog

## 0.1.1

### Alive Mode & Chat UI Rebuild
- Rebuilt the Claude chat interface to support **alive mode** — sessions now stay running and accept follow-up messages via stdin, instead of spawning a new process per prompt
- Full stream-json stdin/stdout protocol: the backend wraps user messages in the correct `{"type":"user","message":...,"session_id":...}` envelope before writing to stdin
- Chat UI redesigned with proper message grouping, tool call rendering, and streaming state

### Interactive Permission Prompts
- Added `--permission-prompt-tool stdio` flag for non-bypass permission modes
- Backend parses `control_request` events (subtype `can_use_tool`) from Claude's stdout and exposes them via SSE to the frontend
- New `PermissionPrompt` component renders tool name, command details, and Allow/Deny buttons inline in the chat
- Backend `POST /sessions/{id}/permission` endpoint builds the `control_response` envelope and writes it to stdin
- Resolved prompts collapse to a single-line summary showing the decision

### Thinking Blocks
- Claude's `thinking` content blocks are now parsed and rendered in the chat
- Collapsible display: shows a "THINKING" label with an 80-char preview when collapsed, full text when expanded

### MCP-First: Auto-wire gnz Tools to Claude Sessions
- Claude sessions automatically receive gnz's MCP server via `--mcp-config` — agents can use database tools, workspace listing, etc. without manual setup
- Generates a temp MCP config file per session, cleaned up on process exit
- Fixed transport type from `http` to `sse` and corrected the endpoint URL to `/mcp/sse` to match the SSE server

### Text Contrast Improvement
- Bumped text tokens for better readability on the matte black background:
  - `--text-primary`: `#d4d4d4` → `#e2e2e2`
  - `--text-secondary`: `#6b6b6b` → `#8a8a8a`
  - `--text-tertiary`: `#404040` → `#5c5c5c`
  - `--text-disabled`: `#282828` → `#3a3a3a`
- Bumped border opacities and accent colors accordingly

### Other
- Default permission mode changed to `bypassPermissions`
- AskUserQuestion prompt simplified (inline chips instead of bordered containers)

## 0.1.0

- Initial release
