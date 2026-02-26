# CLAUDE.md — gnz

## Project Overview

gnz is a no-code IDE for operators — a modular desktop environment for tasks like database management, log viewing, AI agent sessions, and terminal orchestration. It is NOT a code editor. It is NOT a dashboard. It's the tool you use instead of juggling pgAdmin, terminal tabs, and browser windows.

Built with Tauri 2 (Rust shell) + React/TypeScript (UI) + Go (backend sidecar). MCP-first: every capability is exposed as both a UI panel and an MCP tool, so AI agents get the same access as humans. Designed to be lightweight and memory-efficient.

The UI never talks to external services directly — everything routes through the Go backend via HTTP, with Tauri proxying IPC calls.

## Quick Reference

```
ui/              → React frontend (Vite, pnpm)
desktop/         → Tauri 2 Rust shell (cargo)
backend/         → Go backend sidecar
scripts/         → Build and dev scripts
```

## Commands

```bash
make setup          # Install all dependencies
make dev            # Full dev mode (sidecar + Tauri + Vite)
make backend        # Build Go sidecar only
make backend-check  # Vet + build Go backend
make build          # Production build
make clean          # Remove all build artifacts
```

## Cargo / Rust

Always use `--release` for all cargo commands:
- `cargo check --release`, `cargo build --release`, etc.
- Rust code lives in `desktop/` (renamed from `src-tauri`)

## Go Backend

- Module: `github.com/clusterlab-ai/gnz/backend`
- Entry: `backend/cmd/gnz-backend/main.go`
- The binary receives `--port PORT` and prints `READY` to stdout when listening
- App state SQLite: `~/Library/Application Support/com.gnz.app/gnz.db`
- Migrations: `backend/internal/appdb/migrations/` (embedded via `embed.FS`)

### Key packages
| Package | Location | Purpose |
|---------|----------|---------|
| config | `internal/config/` | Typed config with defaults, env vars |
| appdb | `internal/appdb/` | App-state SQLite + migrations |
| workspace | `internal/workspace/` | Workspace CRUD (model, store, service) |
| server | `internal/server/` | Chi router, middleware, response helpers |
| database | `internal/modules/database/` | DB module: connections, pools, queries, tables, MCP tools |
| mcp | `internal/mcp/` | MCP server setup (SSE transport) |

### API Base: `http://127.0.0.1:{port}/api/v1`

Core routes: `GET /ping`, `GET /config`, CRUD `/workspaces`

Database module routes (under `/workspaces/{ws}`):
- `/connections` — CRUD
- `/connections/{id}/test` — test connection
- `/connections/{conn}/tables` — list tables
- `/connections/{conn}/tables/{name}/rows` — paginated rows
- `/connections/{conn}/query` — execute SQL

## React UI

- Package manager: **pnpm** (always use pnpm, not npm/yarn/bun)
- No component libraries — hand-crafted components with CSS custom properties
- Design tokens: `ui/src/styles/tokens.css`
- State: Zustand stores in `ui/src/stores/` and `ui/src/modules/*/stores/`
- IPC: `ui/src/lib/tauri-ipc.ts` — typed wrappers around `invoke()`

### Module system
Each module is self-contained in `ui/src/modules/{name}/`:
- `index.ts` — module registration (id, name, icon, panel component)
- `components/` — module-specific components
- `views/` — full-page views
- `stores/` — Zustand stores

Current modules: `database`, `settings`

### Adding a new module
1. Create `ui/src/modules/{name}/` with index.ts, components, views, stores
2. Register in `ui/src/App.tsx` modules array
3. Add icon to ActivityBar
4. Add panel content to AppShell

## Tauri Shell (desktop/)

- Proxies all frontend IPC to Go backend via HTTP
- Commands: `proxy_get`, `proxy_post`, `proxy_put`, `proxy_delete`
- Sidecar lifecycle: spawn on setup, kill on drop
- Port negotiation: `portpicker` → pass `--port` to Go binary → wait for `READY`

## Feature Flags

Defined in `backend/internal/config/config.go`:
```
DB=true, MCP=true, SQLEditor=true  (MVP)
Logs=false, Dashboard=false         (future)
```

Middleware blocks requests to disabled features. Frontend fetches flags on startup and conditionally renders UI sections.

## Design System

Near-black backgrounds (#0a0a0b), electric teal accent (#2dd4bf), Geist + JetBrains Mono fonts. See `ui/src/styles/tokens.css` for all variables.

## Growing This Project

### Adding a new backend module
1. Create `backend/internal/modules/{name}/`
2. Add `module.go` with `Register(router)` and optionally `RegisterMCPTools(server)`
3. Wire into `cmd/gnz-backend/main.go`

### Adding a new MCP tool
1. Add tool definition in the relevant module's `mcp_tools.go`
2. Register in the module's `RegisterMCPTools()`

### Adding a new database dialect
1. Add driver import to `backend/internal/modules/database/pool.go`
2. Add dialect cases in `tables.go` (ListTables, DescribeTable)
3. Add to `config.SupportedDatabases`

### Planned modules
- **Claude Code sessions**: Session viewer, context inspector, conversation history
- **Logs**: Streaming log viewer with filtering and search
- **Terminals**: Managed terminal sessions
- Each module follows the same pattern: backend module (Go) + frontend module (React) + MCP tools. The shell never changes — new modules plug in.
