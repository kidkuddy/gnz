# gnz

A no-code IDE for operators. Manage databases, run queries, view logs, orchestrate AI agent sessions — without writing application code. MCP-first so every capability is available to both humans and AI agents.

Not a code editor. Not a dashboard. An environment where you do the work you already do, faster.

**Stack**: Tauri 2 (Rust) + React/TypeScript + Go (sidecar) — lightweight, native, memory-efficient.

## Setup

```bash
make setup
```

## Development

```bash
make dev
```

## Build

```bash
make build
```

## Architecture

```
┌─────────────────────────┐
│  Tauri Shell (Rust)      │  ← Native window, IPC proxy
│  desktop/                │
└──────────┬──────────────┘
           │ HTTP (localhost)
┌──────────▼──────────────┐
│  Go Backend (sidecar)    │  ← HTTP API, MCP server, connection pools
│  backend/                │
└──────────┬──────────────┘
           │
     PostgreSQL / MySQL / SQLite
```

Everything routes through the Go sidecar. The UI and MCP clients share the same pools, same state, same tools. What you can do in the UI, an AI agent can do via MCP.

## Project Structure

```
gnz/
├── ui/          # React + TypeScript (Vite)
├── desktop/     # Tauri 2 Rust shell
├── backend/     # Go sidecar
├── scripts/     # Build and dev scripts
└── Makefile
```

## Modules

| Module | Status | Description |
|--------|--------|-------------|
| SQL | shipped | Connections, table browser, query runner |
| Claude Code sessions | planned | Session viewer, context inspector |
| Logs | planned | Streaming log viewer with filtering |
| Terminals | planned | Managed terminal sessions |

## Data Storage

Workspace metadata and app state are stored in a SQLite database. Default locations by platform:

| Platform | Default path |
|----------|-------------|
| macOS | `~/Library/Application Support/com.gnz.app/gnz.db` |
| Linux | `$XDG_DATA_HOME/com.gnz.app/gnz.db` (falls back to `~/.local/share/com.gnz.app/gnz.db`) |
| Windows | `%APPDATA%\com.gnz.app\gnz.db` |
| Other | `~/.gnz/gnz.db` |

Override the location by setting the `GNZ_DATA_DIR` environment variable.

## MCP Tools

Every module exposes MCP tools. Current:

| Tool | Description |
|------|-------------|
| `devtools_sql_query` | Execute SQL, output as markdown or JSON |
| `devtools_list_tables` | List tables for a connection |
| `devtools_describe_table` | Get table schema |
| `devtools_list_connections` | List connections in a workspace |
| `devtools_list_workspaces` | List all workspaces |
