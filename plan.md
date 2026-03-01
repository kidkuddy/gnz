# Herald MVP — Implementation Plan

## Summary

Standalone Go daemon (`herald`) that replaces the Claude Code CLI subprocess model with a native
agent loop against the Anthropic API. SSE-first API, MCP client as its ToolCaller, one SQLite file
per session, permission system, CLI client for manual testing.

---

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │              Herald Daemon                   │
                    │              :9090 (HTTP)                    │
                    │                                             │
   curl / hld ────► │  API (Chi)                                  │
                    │    │                                        │
                    │    ▼                                        │
                    │  SessionManager  ──► goroutine per run      │
                    │    │                                        │
                    │    ▼                                        │
                    │  AgentLoop                                  │
                    │    ├── AnthropicClient (SSE streaming)      │
                    │    ├── ToolCaller (MCP client interface)    │
                    │    │     ├── in-process: fs, exec, web      │
                    │    │     └── external: SSE MCP servers      │
                    │    ├── PermissionGate                       │
                    │    └── EventEmitter ──► SSE to client       │
                    │                                             │
                    │  SessionDB (SQLite file per session)        │
                    └─────────────────────────────────────────────┘
```

---

## Package Layout

```
backend/pkg/herald/
├── anthropic/              ← Anthropic API streaming client
│   ├── client.go           ← SSE streaming, message creation
│   ├── types.go            ← Request/response/event types (Message, ContentBlock, Usage, etc.)
│   └── stream.go           ← SSE line parser, content_block_delta / input_json_delta handling
│
├── agent/                  ← Core agent loop
│   ├── loop.go             ← AgentLoop: send → tool_use → execute → tool_result → repeat
│   └── session.go          ← Session model + active state
│
├── toolcaller/             ← MCP-based tool dispatch
│   ├── caller.go           ← ToolCaller: wraps []MCPClient, routes tool calls, parallel exec
│   └── registry.go         ← Discovers tools from all connected MCP servers at startup
│
├── permissions/            ← Permission gate
│   ├── gate.go             ← PermissionGate interface + channel-based impl
│   └── modes.go            ← default, acceptEdits, bypassPermissions, plan, dontAsk rules
│
├── events/                 ← SSE event definitions
│   ├── types.go            ← Event structs (TextDelta, ToolStart, ToolResult, Usage, etc.)
│   └── emitter.go          ← EventEmitter: writes NDJSON to channel
│
├── db/                     ← Per-session SQLite
│   ├── store.go            ← Open/close per-session DB, message CRUD
│   ├── models.go           ← DB row types
│   └── migrations/
│       └── 001_init.sql    ← messages table
│
├── tools/                  ← Built-in MCP server implementations
│   ├── fs/
│   │   └── server.go       ← MCP server: Read, Write, Edit, Glob, Grep, LS
│   ├── exec/
│   │   └── server.go       ← MCP server: Bash
│   └── web/
│       └── server.go       ← MCP server: WebFetch
│
├── api/                    ← HTTP server
│   ├── server.go           ← Chi router, SSE middleware, startup/shutdown
│   └── handler.go          ← Request handlers (create session, run, permission, messages, health)
│
├── config.go               ← Herald config (env vars, defaults)
├── herald.go               ← Top-level wiring: NewHerald(), Start(), Shutdown()
├── README.md               ← (already exists)
└── ROADMAP.md              ← (already exists)

backend/cmd/herald/         ← Daemon binary
└── main.go

backend/cmd/hld/            ← CLI client
└── main.go
```

---

## 1. Anthropic Streaming Client (`anthropic/`)

### What it does
HTTP client that calls `POST https://api.anthropic.com/v1/messages` with SSE streaming enabled.
Parses the SSE event stream and yields typed Go events.

### Types (`types.go`)
```go
// Request
type MessageRequest struct {
    Model       string          `json:"model"`
    MaxTokens   int             `json:"max_tokens"`
    System      string          `json:"system,omitempty"`
    Messages    []Message       `json:"messages"`
    Tools       []Tool          `json:"tools,omitempty"`
    Stream      bool            `json:"stream"`
}

type Message struct {
    Role    string         `json:"role"`    // "user" | "assistant"
    Content []ContentBlock `json:"content"`
}

type ContentBlock struct {
    Type    string `json:"type"`              // "text" | "tool_use" | "tool_result" | "thinking"
    Text    string `json:"text,omitempty"`
    ID      string `json:"id,omitempty"`       // tool_use id
    Name    string `json:"name,omitempty"`     // tool name
    Input   json.RawMessage `json:"input,omitempty"`
    ToolUseID string `json:"tool_use_id,omitempty"` // for tool_result
    Content   string `json:"content,omitempty"`     // for tool_result
    IsError   bool   `json:"is_error,omitempty"`
}

type Tool struct {
    Name        string          `json:"name"`
    Description string          `json:"description"`
    InputSchema json.RawMessage `json:"input_schema"`
}

// Response metadata
type Usage struct {
    InputTokens       int `json:"input_tokens"`
    OutputTokens      int `json:"output_tokens"`
    CacheReadTokens   int `json:"cache_read_input_tokens"`
    CacheWriteTokens  int `json:"cache_creation_input_tokens"`
}

// SSE events from Anthropic
type StreamEvent struct {
    Type  string          // message_start, content_block_start, content_block_delta, etc.
    Data  json.RawMessage
}
```

### Client (`client.go`)
```go
type Client struct {
    apiKey  string
    baseURL string
    http    *http.Client
}

// Stream sends a MessageRequest and returns a channel of parsed events.
// The caller reads events until the channel closes.
func (c *Client) Stream(ctx context.Context, req MessageRequest) (<-chan StreamEvent, error)
```

### Stream parser (`stream.go`)
- Reads `text/event-stream` response line by line
- Handles: `message_start`, `content_block_start`, `content_block_delta`,
  `content_block_stop`, `message_delta`, `message_stop`
- For `content_block_delta` with type `input_json_delta`: accumulates partial JSON
  for tool_use input across deltas, emits complete tool_use when `content_block_stop` arrives
- Extracts `Usage` from `message_start` and `message_delta`

---

## 2. Agent Loop (`agent/`)

### AgentLoop (`loop.go`)
```go
type AgentLoop struct {
    client       *anthropic.Client
    toolCaller   *toolcaller.ToolCaller
    permissions  permissions.Gate
    emitter      *events.Emitter
    db           *db.SessionDB
    model        string
    systemPrompt string
    maxTurns     int  // safety limit, default 100
}

// Run executes the agent loop for a single user message.
// Blocks until the turn completes (end_turn) or is aborted via ctx.
func (l *AgentLoop) Run(ctx context.Context, sessionID string, message string) error {
    // 1. Load history from SQLite
    // 2. Append user message, save to DB
    // 3. Build tools list from ToolCaller.ListTools()
    // 4. Loop:
    //    a. Call anthropic.Client.Stream() with history + tools
    //    b. Forward text_delta events to emitter
    //    c. Accumulate assistant message (text + tool_use blocks)
    //    d. Save assistant message to DB with usage
    //    e. If no tool_use blocks: emit turn_complete, break
    //    f. For each tool_use block:
    //       - Check permissions.Check(tool, input)
    //       - If denied: emit permission_request, block on channel
    //       - If approved: dispatch via toolCaller.Call()
    //       - Emit tool_start / tool_result events
    //    g. Append all tool_results as a user message, save to DB
    //    h. Continue loop
    // 5. Emit final usage summary
}
```

### Session (`session.go`)
```go
type Session struct {
    ID             string    `json:"id"`
    Name           string    `json:"name"`
    WorkingDir     string    `json:"working_dir"`
    Model          string    `json:"model"`
    PermissionMode string    `json:"permission_mode"`
    SystemPrompt   string    `json:"system_prompt,omitempty"`
    Status         string    `json:"status"` // idle, running, error
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
}
```

### Parallel tool calls
When the assistant response contains multiple `tool_use` blocks:
- Collect all tool calls
- Check permissions for each (sequentially, to avoid UX chaos)
- Execute approved calls concurrently via `toolCaller.CallMany()`
- Respect `HERALD_MAX_TOOL_CONCURRENCY` env var (default: 4)
- Collect all results, append as a single user message with multiple `tool_result` blocks

---

## 3. ToolCaller — MCP Client (`toolcaller/`)

### Design
ToolCaller holds a list of `client.MCPClient` instances (from `mcp-go`).
Each client connects to one MCP server (in-process or external).
At startup, ToolCaller calls `ListTools()` on each client and builds a unified registry.

```go
type ToolCaller struct {
    clients    []client.MCPClient        // connected MCP clients
    tools      map[string]ToolRef        // tool name → which client owns it
    maxWorkers int                        // from HERALD_MAX_TOOL_CONCURRENCY
}

type ToolRef struct {
    Client client.MCPClient
    Tool   mcp.Tool
}

// ListTools returns all discovered tools as Anthropic API Tool definitions.
func (tc *ToolCaller) ListTools() []anthropic.Tool

// Call dispatches a single tool call to the correct MCP client.
func (tc *ToolCaller) Call(ctx context.Context, name string, input json.RawMessage) (string, error)

// CallMany dispatches multiple tool calls concurrently (bounded by maxWorkers).
func (tc *ToolCaller) CallMany(ctx context.Context, calls []ToolCall) []ToolResult
```

### Built-in MCP servers (in-process)
Using `mcp-go`'s `client.NewInProcessClient(srv)`:
```go
// In herald.go startup:
fsSrv := fs.NewServer(workingDir)
execSrv := exec.NewServer(workingDir)
webSrv := web.NewServer()

fsClient, _ := client.NewInProcessClient(fsSrv)
execClient, _ := client.NewInProcessClient(execSrv)
webClient, _ := client.NewInProcessClient(webSrv)

toolCaller.AddClient(fsClient)
toolCaller.AddClient(execClient)
toolCaller.AddClient(webClient)
```

### External MCP servers
Configured via `--mcp-config` flag or `HERALD_MCP_CONFIG` env (JSON file, same format as Claude Code):
```json
{
  "mcpServers": {
    "gnz-devtools": { "type": "sse", "url": "http://127.0.0.1:8080/mcp/sse" }
  }
}
```
These use `client.NewSSEMCPClient(url)` from `mcp-go`.

---

## 4. Built-in MCP Tool Servers (`tools/`)

Each is a `*server.MCPServer` from `mcp-go`, used in-process.

### fs/server.go — File System Tools

| Tool | Parameters | Notes |
|------|-----------|-------|
| `herald_read` | `file_path`, `offset?`, `limit?` | Read file, line numbers, max 2000 lines default |
| `herald_write` | `file_path`, `content` | Create or overwrite |
| `herald_edit` | `file_path`, `old_string`, `new_string`, `replace_all?` | Exact string replace. Error if old_string not found or ambiguous |
| `herald_glob` | `pattern`, `path?` | filepath.Glob, sorted by mtime |
| `herald_grep` | `pattern`, `path?`, `glob?`, `type?`, `output_mode?`, `-A?`, `-B?`, `-C?` | Shell out to `rg` if available, fallback to Go regex |
| `herald_ls` | `path`, `ignore?` | Directory listing |

All paths are resolved relative to the session's `working_dir`. Absolute paths outside `working_dir` are rejected in `default` and `acceptEdits` modes (permission gate handles this).

### exec/server.go — Bash Execution

| Tool | Parameters | Notes |
|------|-----------|-------|
| `herald_bash` | `command`, `timeout?`, `description?` | `exec.CommandContext` with `/bin/bash -c`. Captures stdout+stderr. Default timeout: 120s. Max: 600s |

- Uses `cmd.Dir = workingDir`
- Merges env from session config
- Returns combined stdout+stderr (labeled)
- Timeout via context.WithTimeout
- **No PTY in MVP** — pipe mode only

### web/server.go — Web Fetch

| Tool | Parameters | Notes |
|------|-----------|-------|
| `herald_web_fetch` | `url`, `prompt?` | HTTP GET, convert HTML to plain text (strip tags). If `prompt` provided, summarize (future: call Claude for summarization). Max response: 1MB |

---

## 5. Permission Gate (`permissions/`)

### Gate interface (`gate.go`)
```go
type Gate interface {
    // Check returns (approved, error). If the gate needs user input,
    // it emits a permission_request event and blocks until the user responds.
    Check(ctx context.Context, sessionID string, tool string, input json.RawMessage) (bool, error)
}
```

### Mode rules (`modes.go`)

| Mode | Bash | Write/Edit (in cwd) | Write/Edit (outside cwd) | Read/Glob/Grep/LS |
|------|------|---------------------|--------------------------|-------------------|
| `default` | ask | ask | ask | auto |
| `acceptEdits` | ask | auto | ask | auto |
| `bypassPermissions` | auto | auto | auto | auto |
| `plan` | deny | deny | deny | auto |
| `dontAsk` | auto | auto | auto | auto |

When `ask` → emit `permission_request` SSE event with a `request_id`, block on a channel.
API endpoint `POST /sessions/{id}/permission/{request_id}` with `{"approved": true/false}` unblocks.

---

## 6. Per-Session SQLite (`db/`)

### Location
Each session gets its own file: `{data_dir}/sessions/{session_id}.db`

### Schema (`migrations/001_init.sql`)
```sql
CREATE TABLE messages (
    id          TEXT PRIMARY KEY,
    role        TEXT NOT NULL,           -- 'user', 'assistant'
    content     TEXT NOT NULL,           -- JSON array of ContentBlocks
    input_tokens       INTEGER DEFAULT 0,
    output_tokens      INTEGER DEFAULT 0,
    cache_read_tokens  INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    model              TEXT DEFAULT '',
    stop_reason        TEXT DEFAULT '',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE metadata (
    key   TEXT PRIMARY KEY,
    value TEXT
);
-- metadata stores: session name, model, working_dir, permission_mode, system_prompt, etc.
```

### Store (`store.go`)
```go
type SessionDB struct {
    db *sql.DB
}

func Open(dataDir, sessionID string) (*SessionDB, error)
func (s *SessionDB) SaveMessage(msg *MessageRow) error
func (s *SessionDB) ListMessages() ([]MessageRow, error)
func (s *SessionDB) GetUsageTotals() (*UsageTotals, error)
func (s *SessionDB) SetMeta(key, value string) error
func (s *SessionDB) GetMeta(key string) (string, error)
func (s *SessionDB) Close() error
```

---

## 7. SSE Events (`events/`)

### Event types (`types.go`)
All events are JSON objects with a `type` field and a `session_id` field.

```go
type Event struct {
    Type      string `json:"type"`
    SessionID string `json:"session_id"`
}

type TextDelta struct {
    Event
    Text string `json:"text"`
}

type ThinkingDelta struct {
    Event
    Text string `json:"text"`
}

type ToolStart struct {
    Event
    CallID string          `json:"call_id"`
    Tool   string          `json:"tool"`
    Input  json.RawMessage `json:"input"`
}

type ToolResult struct {
    Event
    CallID     string `json:"call_id"`
    Tool       string `json:"tool"`
    Output     string `json:"output"`
    IsError    bool   `json:"is_error"`
    DurationMs int64  `json:"duration_ms"`
}

type PermissionRequest struct {
    Event
    RequestID string          `json:"request_id"`
    Tool      string          `json:"tool"`
    Input     json.RawMessage `json:"input"`
}

type Usage struct {
    Event
    InputTokens      int     `json:"input_tokens"`
    OutputTokens     int     `json:"output_tokens"`
    CacheReadTokens  int     `json:"cache_read_tokens"`
    CacheWriteTokens int     `json:"cache_write_tokens"`
    CostUSD          float64 `json:"cost_usd"`
}

type TurnComplete struct {
    Event
    StopReason string `json:"stop_reason"` // "end_turn" | "max_turns" | "error" | "aborted"
}

type ErrorEvent struct {
    Event
    Message string `json:"message"`
}
```

### Emitter (`emitter.go`)
```go
type Emitter struct {
    ch chan []byte  // serialized JSON events
}

func (e *Emitter) Emit(event any) // JSON-marshal + push to channel
func (e *Emitter) Channel() <-chan []byte
```

---

## 8. HTTP API (`api/`)

### Routes

```
GET    /health                                  → health check + version + connected MCP servers
POST   /sessions                                → create session
GET    /sessions                                → list sessions (from session DB files on disk)
GET    /sessions/{id}                           → get session info + usage totals
DELETE /sessions/{id}                           → abort if running + delete session DB file
POST   /sessions/{id}/message                   → run user message (SSE stream response)
POST   /sessions/{id}/permission/{request_id}   → respond to permission request
GET    /sessions/{id}/messages                  → list all messages in session
```

### Create session — `POST /sessions`
```json
// Request
{
    "id": "optional-client-uuid",          // server generates if omitted
    "name": "optional name",
    "working_dir": "/path/to/project",     // required
    "model": "claude-sonnet-4-6",          // default: claude-sonnet-4-6
    "permission_mode": "acceptEdits",      // default: default
    "system_prompt": "optional system prompt"
}

// Response (201)
{
    "ok": true,
    "data": {
        "id": "uuid",
        "name": "...",
        "working_dir": "...",
        "model": "...",
        "permission_mode": "...",
        "status": "idle",
        "created_at": "..."
    }
}
```

### Run message — `POST /sessions/{id}/message` → SSE stream
```json
// Request
{ "message": "list files in current directory" }

// Response: text/event-stream
event: message
data: {"type":"text_delta","session_id":"...","text":"I'll list"}

event: message
data: {"type":"text_delta","session_id":"...","text":" the files"}

event: message
data: {"type":"tool_start","session_id":"...","call_id":"toolu_01X","tool":"herald_bash","input":{"command":"ls -la"}}

event: message
data: {"type":"tool_result","session_id":"...","call_id":"toolu_01X","tool":"herald_bash","output":"total 42\ndrwxr-xr-x ...","is_error":false,"duration_ms":45}

event: message
data: {"type":"text_delta","session_id":"...","text":"Here are the files..."}

event: message
data: {"type":"usage","session_id":"...","input_tokens":1234,"output_tokens":567,"cache_read_tokens":0,"cache_write_tokens":0,"cost_usd":0.0042}

event: message
data: {"type":"turn_complete","session_id":"...","stop_reason":"end_turn"}

event: done
data: {}
```

### Permission respond — `POST /sessions/{id}/permission/{request_id}`
```json
{ "approved": true }
```

### Health — `GET /health`
```json
{
    "ok": true,
    "data": {
        "version": "0.1.0",
        "mcp_servers": [
            {"name": "herald-fs", "tools": 6, "status": "connected"},
            {"name": "herald-exec", "tools": 1, "status": "connected"},
            {"name": "herald-web", "tools": 1, "status": "connected"}
        ],
        "active_sessions": 2
    }
}
```

---

## 9. Herald Wiring (`herald.go`)

```go
type Herald struct {
    cfg        *Config
    toolCaller *toolcaller.ToolCaller
    sessions   map[string]*activeSession  // guarded by sync.RWMutex
    dataDir    string
}

type activeSession struct {
    session *agent.Session
    loop    *agent.AgentLoop
    db      *db.SessionDB
    cancel  context.CancelFunc
}

func New(cfg *Config) (*Herald, error)  // wire everything
func (h *Herald) Start() error          // start HTTP server
func (h *Herald) Shutdown() error       // graceful shutdown
```

Startup sequence:
1. Parse config (flags + env)
2. Create data directory (`{dataDir}/sessions/`)
3. Create built-in MCP servers (fs, exec, web) → in-process clients
4. Connect external MCP servers from config → SSE clients
5. Build ToolCaller with all clients
6. Start HTTP server
7. Print `READY` to stdout

---

## 10. Config (`config.go`)

```go
type Config struct {
    Port          int    // --port or HERALD_PORT (default: 9090)
    DataDir       string // --data-dir or HERALD_DATA_DIR (default: ~/.herald)
    APIKey        string // ANTHROPIC_API_KEY (required)
    DefaultModel  string // HERALD_DEFAULT_MODEL (default: claude-sonnet-4-6)
    MaxConcurrency int   // HERALD_MAX_TOOL_CONCURRENCY (default: 4)
    MCPConfigPath string // --mcp-config or HERALD_MCP_CONFIG (optional JSON file)
}
```

---

## 11. Daemon Binary (`cmd/herald/main.go`)

```
Usage: herald [flags]

Flags:
  --port          HTTP port (default: 9090, env: HERALD_PORT)
  --data-dir      Data directory (default: ~/.herald, env: HERALD_DATA_DIR)
  --mcp-config    Path to MCP servers config JSON (env: HERALD_MCP_CONFIG)
```

Startup: parse flags → `herald.New(cfg)` → `h.Start()` → signal handler → `h.Shutdown()`.

---

## 12. CLI Client (`cmd/hld/main.go`)

Minimal CLI that talks to the Herald HTTP API. No TUI framework — just formatted stdout.

```
Usage:
  hld run [flags] "message"         Run a message in a session (creates one if needed)
  hld session create [flags]        Create a new session
  hld session list                  List all sessions
  hld session messages <id>         Show message history
  hld health                       Check Herald daemon health

Flags for run:
  --session, -s    Session UUID (creates new if omitted)
  --model, -m      Model override
  --dir, -d        Working directory (default: cwd)
  --mode           Permission mode (default: default)
  --herald         Herald daemon URL (default: http://localhost:9090)
```

`hld run` flow:
1. POST `/sessions` (if no --session)
2. POST `/sessions/{id}/message` with `Accept: text/event-stream`
3. Read SSE events, format to terminal:
   - `text_delta` → print text (stream to stdout)
   - `thinking_delta` → print dimmed/gray
   - `tool_start` → print `[tool] command...` in cyan
   - `tool_result` → print output indented, errors in red
   - `permission_request` → prompt stdin `Allow [tool]? (y/n): `
     - POST `/sessions/{id}/permission/{req_id}` with response
   - `usage` → print token counts dimmed
   - `turn_complete` → print done
   - `error` → print in red, exit 1

---

## 13. Manual Testing (no gnz, no hld)

```bash
# 1. Build Herald
cd backend && go build --release -o herald ./cmd/herald/

# 2. Start daemon
export ANTHROPIC_API_KEY=sk-ant-...
./herald --port 9090 --data-dir /tmp/herald-test

# 3. Create a session
curl -s -X POST http://localhost:9090/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-001",
    "working_dir": "/tmp",
    "model": "claude-sonnet-4-6",
    "permission_mode": "bypassPermissions"
  }' | jq .

# 4. Run a message (SSE stream — use -N for no-buffer)
curl -N -X POST http://localhost:9090/sessions/test-001/message \
  -H "Content-Type: application/json" \
  -d '{"message": "what files are in the current directory?"}'

# 5. Check messages stored
curl -s http://localhost:9090/sessions/test-001/messages | jq .

# 6. Check health
curl -s http://localhost:9090/health | jq .

# 7. Send another message (same session, has history)
curl -N -X POST http://localhost:9090/sessions/test-001/message \
  -H "Content-Type: application/json" \
  -d '{"message": "now create a file called hello.txt with the content Hello World"}'

# 8. If using permission mode "default", permissions come as SSE events:
#    event: message
#    data: {"type":"permission_request","session_id":"test-001","request_id":"perm-abc","tool":"herald_bash","input":{"command":"..."}}
#
#    Respond with:
curl -X POST http://localhost:9090/sessions/test-001/permission/perm-abc \
  -H "Content-Type: application/json" \
  -d '{"approved": true}'

# 9. Delete session
curl -X DELETE http://localhost:9090/sessions/test-001
```

---

## Implementation Order

| Step | What | Files | Depends on |
|------|------|-------|------------|
| 1 | Anthropic streaming client | `anthropic/types.go`, `anthropic/client.go`, `anthropic/stream.go` | nothing |
| 2 | Event types + emitter | `events/types.go`, `events/emitter.go` | nothing |
| 3 | Per-session SQLite store | `db/models.go`, `db/store.go`, `db/migrations/001_init.sql` | nothing |
| 4 | Config | `config.go` | nothing |
| 5 | Built-in MCP tool servers | `tools/fs/server.go`, `tools/exec/server.go`, `tools/web/server.go` | nothing |
| 6 | ToolCaller (MCP client wrapper) | `toolcaller/caller.go`, `toolcaller/registry.go` | step 5 |
| 7 | Permission gate | `permissions/gate.go`, `permissions/modes.go` | step 2 |
| 8 | Agent loop | `agent/session.go`, `agent/loop.go` | steps 1-7 |
| 9 | HTTP API | `api/server.go`, `api/handler.go` | step 8 |
| 10 | Herald top-level wiring | `herald.go` | steps 4-9 |
| 11 | Daemon binary | `cmd/herald/main.go` | step 10 |
| 12 | CLI client | `cmd/hld/main.go` | step 11 (runtime dep only) |

Steps 1-5 are independent and can be built in parallel.
Steps 6-7 need step 5 and step 2 respectively.
Steps 8+ are sequential.

---

## Dependencies

Already in `go.mod`:
- `github.com/go-chi/chi/v5` — HTTP router
- `github.com/mark3labs/mcp-go` — MCP server + **client** (both supported)
- `modernc.org/sqlite` — SQLite driver
- `github.com/google/uuid` — UUID generation

New (to add):
- `github.com/anthropics/anthropic-sdk-go` — **NOT used.** We write our own streaming client (the official Go SDK may not exist or may not support streaming well enough). Raw HTTP + SSE parsing keeps it dependency-free and transparent.

No new dependencies needed for the MVP.
