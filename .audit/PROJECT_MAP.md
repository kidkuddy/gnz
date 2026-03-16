# gnz — Project Map

_Audited: 2026-03-06 | Mode: standard_

---

## Purpose

gnz is a no-code IDE for operators — a modular desktop environment for database management, AI agent sessions, terminal orchestration, git operations, kanban boards, and more. Built for the vibe coding era: every feature is exposed as both a UI panel and an MCP tool, so AI agents get the same access as humans.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Shell | Tauri 2 (Rust) | 2.3.1 |
| Backend | Go | 1.23 |
| Frontend | React 19 + TypeScript | 19.0 |
| State | Zustand | latest |
| Router (Go) | Chi | v5.2 |
| Router (React) | TanStack Router | latest |
| App DB | SQLite (embedded) | via go-sqlite3 |
| MCP | mark3labs/mcp-go | v0.28 |
| Terminal | creack/pty + xterm.js | latest |
| Editor | CodeMirror | latest |
| Build | Make + Go + Cargo + pnpm + Vite | — |

## Architecture

```
┌─────────────────────────────────────┐
│  React 19 SPA (ui/)                 │
│  Zustand stores + Tab Registry      │
│  Module panels + views              │
└──────────────┬──────────────────────┘
               │ Tauri IPC (invoke)
┌──────────────▼──────────────────────┐
│  Tauri 2 Shell (desktop/)           │
│  proxy_get/post/put/delete          │
│  Sidecar lifecycle management       │
└──────────────┬──────────────────────┘
               │ HTTP localhost:{port}
┌──────────────▼──────────────────────┐
│  Go Backend Sidecar (backend/)      │
│  Chi router + CORS middleware       │
│  ┌────────────────────────────────┐ │
│  │ Modules:                       │ │
│  │  database  galacta  git        │ │
│  │  terminal  kanban   actions    │ │
│  │  scratchpad  files             │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │ Core:                          │ │
│  │  appdb  workspace  config      │ │
│  │  server  mcp                   │ │
│  └────────────────────────────────┘ │
│  MCP Server (SSE on /mcp)           │
└──────────────┬──────────────────────┘
               │ MCP tools
┌──────────────▼──────────────────────┐
│  Galacta Daemon (external)          │
│  AI agent sessions                  │
│  Connects back via MCP              │
└─────────────────────────────────────┘
```

## Scopes

| Name | Path | Type | Entry Point | Tech |
|------|------|------|-------------|------|
| Backend | `backend/` | Go HTTP sidecar | `cmd/gnz-backend/main.go` | Go 1.23, Chi, SQLite |
| Desktop | `desktop/` | Tauri 2 Rust shell | `src/lib.rs` | Rust, Tauri 2, reqwest |
| UI | `ui/` | React SPA | `src/main.tsx` | React 19, Zustand, Vite |

---

## Cross-Scope Contracts

### API Response Envelope

All backend responses follow:
```json
{"ok": true|false, "data": <T>, "error": "message"}
```
Defined in `backend/internal/server/response.go`. Tauri shell unwraps `.data` field before returning to UI.

### Shared Types

| Type | Backend | Frontend | MCP |
|------|---------|----------|-----|
| Workspace | `workspace/model.go` | `tauri-ipc.ts` | `devtools_list_workspaces` |
| Connection | `database/connection.go` | `tauri-ipc.ts` | `devtools_list_connections` |
| GalactaSession | `galacta/store.go` | `galacta-store.ts` | — |
| TerminalSession | `terminal/model.go` | `terminal-store.ts` | — |
| GitRepo/Status | `git/executor.go` | `git-store.ts` | — |
| Action/ActionRun | `actions/model.go` | `actions-store.ts` | `devtools_list_actions` |
| KanbanBoard/Card | `kanban/models.go` | `kanban-store.ts` | `kanban_*` |
| Scratchpad | `scratchpad/model.go` | `scratchpad-store.ts` | — |

### IPC Contract (Tauri ↔ UI)

| Command | Direction | Protocol |
|---------|-----------|----------|
| `get_backend_port` | UI → Tauri | IPC invoke |
| `proxy_get(path)` | UI → Tauri → Backend | IPC → HTTP GET |
| `proxy_post(path, body)` | UI → Tauri → Backend | IPC → HTTP POST |
| `proxy_put(path, body)` | UI → Tauri → Backend | IPC → HTTP PUT |
| `proxy_delete(path)` | UI → Tauri → Backend | IPC → HTTP DELETE |

### Sidecar Contract (Tauri → Backend)

- Binary: `gnz-backend-{TARGET_TRIPLE}`
- Launch: `{binary} --port {port}`
- Ready signal: prints `READY` to stdout
- Shutdown: SIGTERM on app exit

---

## External Contracts (Per Scope)

### Backend HTTP API

**Base:** `http://127.0.0.1:{port}/api/v1`

#### Core
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ping` | GET | Health check |
| `/config` | GET | Feature flags + config |
| `/workspaces` | GET, POST | List/create workspaces |
| `/workspaces/{id}` | GET, PUT, DELETE | Workspace CRUD |

#### Database Module
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/workspaces/{ws}/connections` | GET, POST | List/create connections |
| `/workspaces/{ws}/connections/{id}` | DELETE | Delete connection |
| `/workspaces/{ws}/connections/{id}/test` | POST | Test connection |
| `/workspaces/{ws}/connections/{conn}/tables` | GET | List tables |
| `/workspaces/{ws}/connections/{conn}/tables/{name}/rows` | GET | Paginated rows |
| `/workspaces/{ws}/connections/{conn}/query` | POST | Execute SQL |

#### Galacta Module
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/galacta/status` | GET | Daemon health |
| `/galacta/launch` | POST | Start/restart daemon |
| `/galacta/logs` | GET | Daemon logs |
| `/workspaces/{ws}/galacta/sessions` | GET, POST | List/create sessions |
| `/workspaces/{ws}/galacta/sessions/{id}` | PATCH, DELETE | Update/archive session |
| `/workspaces/{ws}/galacta/sessions/discover` | GET | Find untracked sessions |
| `/workspaces/{ws}/galacta/sessions/import` | POST | Import external session |

#### Terminal Module
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/workspaces/{ws}/terminals` | GET, POST | List/create terminals |
| `/workspaces/{ws}/terminals/{id}` | DELETE | Kill terminal |
| `/workspaces/{ws}/terminals/{id}/stream` | GET (SSE) | Output stream |
| `/workspaces/{ws}/terminals/{id}/input` | POST | Send input (base64) |
| `/workspaces/{ws}/terminals/{id}/resize` | POST | Resize PTY |
| `/workspaces/{ws}/terminals/{id}/rename` | POST | Rename session |

#### Git Module
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/workspaces/{ws}/git/repos` | GET | Discover repos |
| `/workspaces/{ws}/git/status` | GET | Repo status |
| `/workspaces/{ws}/git/stage` | POST | Stage files |
| `/workspaces/{ws}/git/unstage` | POST | Unstage files |
| `/workspaces/{ws}/git/discard` | POST | Discard changes |
| `/workspaces/{ws}/git/commit` | POST | Commit |
| `/workspaces/{ws}/git/push` | POST | Push |
| `/workspaces/{ws}/git/pull` | POST | Pull |
| `/workspaces/{ws}/git/log` | GET | Commit log |
| `/workspaces/{ws}/git/diff` | GET | Commit diff |
| `/workspaces/{ws}/git/file-diff` | GET | File diff |
| `/workspaces/{ws}/git/branches` | GET | List branches |
| `/workspaces/{ws}/git/branches/checkout` | POST | Checkout branch |
| `/workspaces/{ws}/git/branches/create` | POST | Create branch |
| `/workspaces/{ws}/git/stash` | GET | List stashes |
| `/workspaces/{ws}/git/stash/push` | POST | Create stash |
| `/workspaces/{ws}/git/stash/apply` | POST | Apply stash |
| `/workspaces/{ws}/git/stash/drop` | POST | Drop stash |

#### Actions Module
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/workspaces/{ws}/actions` | GET, POST | List/create actions |
| `/workspaces/{ws}/actions/{id}` | PUT, DELETE | Update/delete action |
| `/workspaces/{ws}/actions/{id}/run` | POST | Execute action |
| `/workspaces/{ws}/actions/{id}/runs` | GET | List runs |
| `/workspaces/{ws}/actions/running` | GET | List running |
| `/workspaces/{ws}/actions/runs/{runId}` | GET | Get run status |
| `/workspaces/{ws}/actions/runs/{runId}/kill` | POST | Kill run |
| `/workspaces/{ws}/actions/runs/{runId}/stream` | GET (SSE) | Stream output |
| `/workspaces/{ws}/actions/logs/search` | GET | Search run logs |

#### Kanban Module
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/workspaces/{ws}/kanban/boards` | GET, POST | List/create boards |
| `/workspaces/{ws}/kanban/boards/{board}` | GET, PUT, DELETE | Board CRUD |
| `/workspaces/{ws}/kanban/boards/{board}/columns` | GET, POST | List/create columns |
| `/workspaces/{ws}/kanban/columns/{col}` | PUT, DELETE | Column CRUD |
| `/workspaces/{ws}/kanban/boards/{board}/cards` | GET, POST | List/create cards |
| `/workspaces/{ws}/kanban/boards/{board}/cards/{card}` | GET, PUT, DELETE | Card CRUD |
| `/workspaces/{ws}/kanban/boards/{board}/labels` | GET, POST | List/create labels |
| `/workspaces/{ws}/kanban/cards/{card}/labels` | POST | Attach label |
| `/workspaces/{ws}/kanban/cards/{card}/labels/{label}` | DELETE | Detach label |
| `/workspaces/{ws}/kanban/cards/{card}/subtasks` | GET, POST | List/create subtasks |
| `/workspaces/{ws}/kanban/subtasks/{sub}` | PUT, DELETE | Subtask CRUD |
| `/workspaces/{ws}/kanban/cards/{card}/subtasks/{sub}/launch` | POST | Launch as agent |

#### Scratchpad Module
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/workspaces/{ws}/scratchpads` | GET, POST | List/create pads |
| `/workspaces/{ws}/scratchpads/{id}` | GET, PUT, DELETE | Pad CRUD |
| `/workspaces/{ws}/scratchpads/{id}/rename` | POST | Rename pad |

#### Files Module
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/workspaces/{ws}/files/search` | GET | Search files by name |
| `/workspaces/{ws}/files/read` | GET | Read file content |

### MCP Tools

| Tool | Module | Parameters |
|------|--------|-----------|
| `devtools_list_workspaces` | Core | — |
| `devtools_list_connections` | Database | workspace_id |
| `devtools_list_tables` | Database | workspace_id, connection_id |
| `devtools_sql_query` | Database | workspace_id, connection_id, sql, output_format |
| `devtools_list_actions` | Actions | workspace_id |
| `devtools_run_action` | Actions | workspace_id, action_name |
| `devtools_action_status` | Actions | workspace_id, run_id |
| `kanban_list_boards` | Kanban | workspace_id |
| `kanban_get_board` | Kanban | workspace_id, board_id |
| `kanban_create_card` | Kanban | workspace_id, board_id, column_id, title, description, priority |
| `kanban_update_card` | Kanban | workspace_id, board_id, card_id, ... |
| `kanban_move_card` | Kanban | workspace_id, board_id, card_id, column_id, position |
| `kanban_list_subtasks` | Kanban | workspace_id, card_id |
| `kanban_create_subtask` | Kanban | workspace_id, card_id, title, prompt, context_deps |
| `kanban_launch_subtask` | Kanban | workspace_id, card_id, subtask_id |
| `kanban_update_deliverable` | Kanban | subtask_id, deliverable |

**MCP Gap:** Git, terminal, scratchpad, files, and galacta modules have NO MCP tools.

---

## Shared Package Policy

| Package | Owner | Consumers | Change Policy |
|---------|-------|-----------|---------------|
| `internal/appdb` | Core | All modules | Append-only migrations |
| `internal/config` | Core | Backend startup | Feature flags only |
| `internal/server` | Core | All modules | Response envelope locked |
| `internal/workspace` | Core | All modules, MCP | Model stable |
| `internal/mcp` | Core | External agents | Tool registration only |

---

## Build Matrix

| Scope | Build | Test | Artifact | Target |
|-------|-------|------|----------|--------|
| Backend | `go build -o ../desktop/binaries/$(SIDECAR) ./cmd/gnz-backend/` | None | `gnz-backend-{triple}` | `desktop/binaries/` |
| Desktop | `cargo build --release` (via tauri-build) | None | `gnz.app` | macOS DMG |
| UI | `pnpm build` (Vite) | None | `ui/dist/` | Embedded in Tauri |
| All | `make build` | None | Full app bundle | macOS (primary) |

---

## Bounded Contexts

### Core Infrastructure (Shared)

#### Workspace Management
- **State:** ready
- **Files:** `workspace/model.go`, `workspace/store.go`, `workspace/service.go`, `server/routes.go`, `ui/stores/workspace-store.ts`
- **Notes:** Fundamental isolation unit. All resources scoped by workspace_id FK.

#### App State Persistence
- **State:** ready
- **Files:** `appdb/appdb.go`, `appdb/migrations/*.sql` (14 migrations)
- **Notes:** SQLite WAL mode, MaxOpenConns=1, embedded migrations via embed.FS.

#### HTTP Server & IPC Proxy
- **State:** ready
- **Files:** `server/server.go`, `desktop/src/commands.rs`, `ui/lib/tauri-ipc.ts`
- **Notes:** Tauri proxies all IPC to Go backend. Port negotiated via portpicker.

### Feature Modules (Scope-Local)

#### Galacta (AI Sessions)
- **State:** ready
- **Features:** Session lifecycle, discovery/import, SSE proxy, daemon lifecycle
- **MCP:** None (gap)
- **Files:** `modules/galacta/*`, `ui/modules/galacta/*`
- **Notes:** Tightly coupled to external Galacta daemon. Auto-launches on startup. MCP config written to `/tmp`.

#### Database
- **State:** ready
- **Features:** Connection management, table browsing, query execution
- **MCP:** `devtools_list_connections`, `devtools_list_tables`, `devtools_sql_query`
- **Files:** `modules/database/*`, `ui/modules/database/*`
- **Notes:** SQL injection vulnerabilities (SEC-001, SEC-002). DSN stored plaintext.

#### Terminal
- **State:** ready
- **Features:** PTY sessions, SSE streaming, input/resize
- **MCP:** None (gap)
- **Files:** `modules/terminal/*`, `ui/modules/terminal/*`
- **Notes:** Ephemeral — sessions don't survive restart. Output base64-encoded. Channel drops on slow consumer.

#### Git
- **State:** ready
- **Features:** Repo discovery, status, staging, commit, branch, stash, diff
- **MCP:** None (gap)
- **Files:** `modules/git/*`, `ui/modules/git/*`
- **Notes:** Uses git CLI via os/exec. Command injection risk (SEC-004).

#### Actions
- **State:** ready
- **Features:** Command definitions, execution, streaming, history/search
- **MCP:** `devtools_list_actions`, `devtools_run_action`, `devtools_action_status`
- **Files:** `modules/actions/*`, `ui/modules/actions/*`
- **Notes:** Command injection by design (SEC-003). Log files in `/tmp`.

#### Kanban
- **State:** ready
- **Features:** Boards, columns, cards, labels, subtasks with dependencies, agent launch
- **MCP:** Full suite (12 tools)
- **Files:** `modules/kanban/*`, `ui/modules/kanban/*`
- **Notes:** Most complex module (646-line store). Subtask→Galacta coupling. Logic duplicated in HTTP + MCP handlers.

#### Scratchpad
- **State:** ready
- **Features:** Multi-workspace text pads
- **MCP:** None (gap)
- **Files:** `modules/scratchpad/*`, `ui/modules/scratchpad/*`
- **Notes:** Simple, isolated. Last-write-wins (no conflict handling).

#### Files
- **State:** ready
- **Features:** File search, content read
- **MCP:** None (gap)
- **Files:** `modules/files/*`, `ui/modules/search/*`
- **Notes:** Read-only. Full directory walk on every search (no index). Symlink traversal risk.

---

## Patterns & Architecture

### Architectural Pattern
Modular three-tier with thin proxy: **UI → IPC Proxy → HTTP Backend → Modules → Storage/CLI**. Each module follows Handler→Service→Store layering (some skip Service). MCP tools are registered per-module. Architecture is coherent and sustainable to ~15 modules.

### Load-Bearing Patterns

| Pattern | Assessment | Impact |
|---------|-----------|--------|
| Module Registration (Register function) | Intentional | Enables rapid module addition |
| Tauri IPC Envelope Unwrap | Intentional | Decouples UI from backend |
| Tab Registry (React) | Intentional | Clean module UI isolation |
| SQLite MaxOpenConns=1 | Intentional | Single-writer safety |
| Workspace Scoping (Chi URL param) | Intentional | Multi-tenant isolation |
| sync.Mutex in Managers | Partial | Works but no context propagation |

### Cross-Cutting Concerns

| Concern | Status | Gap |
|---------|--------|-----|
| Auth | None (by design) | No guardrail if exposed to network |
| Input Validation | Scattered (37 sites) | No shared schema/validator |
| Error Handling | Raw strings | No structured codes |
| Logging | Mixed (log + slog) | No request correlation |
| Caching | None | Frontend re-fetches everything |
| Rate Limiting | None | Expensive ops unprotected |
| Timeouts | None | Slow queries/commands can hang |
| Graceful Shutdown | Partial | Galacta uses pkill, terminals may leak |

---

## Data Flows

### Database Query
```
UI → proxy_post("/connections/{conn}/query", {sql}) → Tauri → HTTP POST → handler.ExecuteQuery
  → PoolManager.GetOrCreate (mutex) → sql.DB.Query → rows → JSON response
```

### Terminal Session
```
UI → proxy_post("/terminals", {name,cwd,cols,rows}) → Tauri → HTTP POST → manager.Create
  → pty.StartWithSize → goroutine reads PTY → events channel (256 buffer)
UI → EventSource("/terminals/{id}/stream") → SSE loop reads channel → base64 output
UI → proxy_post("/terminals/{id}/input", {data: base64}) → manager.Write → pty.Write
```

### Kanban Subtask Launch
```
UI → POST /kanban/cards/{card}/subtasks/{sub}/launch → handler.LaunchSubtask
  → check context_deps all done → build prompt (card + subtask + dep deliverables)
  → galactaSvc.Create(session) → Galacta daemon creates AI session
  → agent calls MCP tools (kanban_update_deliverable) → subtask.status = done
```

---

## Feature Flags

| Flag | Default | Controls |
|------|---------|----------|
| `GNZ_FEATURE_DB` | true | Database module |
| `GNZ_FEATURE_GALACTA` | true | Galacta module + auto-launch |
| `GNZ_FEATURE_MCP` | true | MCP server |
| `GNZ_FEATURE_SQL_EDITOR` | true | SQL editor UI |
| `GNZ_FEATURE_LOGS` | false | Log viewer (future) |
| `GNZ_FEATURE_DASHBOARD` | false | Dashboard (future) |

**Note:** Feature flags are disconnected from module system. Checked manually in `main.go`.

---

## Open Questions

1. **Module interface:** What should the formal `Module` contract look like? Should it enforce MCP tool registration?
2. **MCP as internal transport:** Could UI↔backend communication use MCP instead of REST? What about streaming?
3. **Feature flags vs modules:** Should feature flags be a property of the module definition?
4. **Galacta coupling:** Is the tight kanban→galacta coupling intentional long-term, or should agent launching be a generic module capability?
5. **State sync:** When Galacta daemon crashes, gnz doesn't know. Should there be a heartbeat/reconciliation mechanism?
6. **Multi-window:** Tauri supports multiple windows. How should state sync across them?
7. **Terminal persistence:** Should terminal sessions survive app restart (like tmux)?
8. **File write operations:** Should the files module support create/edit/delete?
9. **Database credentials:** DSN stored plaintext in SQLite. Should there be encryption or keychain integration?
10. **Module marketplace:** Could third-party modules be loaded dynamically?
