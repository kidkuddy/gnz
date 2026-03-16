# Kanban Module — Implementation Plan

## Overview

A full Kanban module for gnz: backend (Go) + frontend (React/TS) + MCP tools. Cards live in gnz's SQLite app DB. One board shown in UI, multiple boards supported in schema. Cards have sub-tasks that are Galacta agent sessions with chained deliverables.

---

## Part 0 — Galacta session creation API

Before the Kanban module can launch sub-tasks as sessions, the galacta package needs a
programmatic way to create a session from Go code (not just via HTTP from the frontend).

### `galacta.Service.CreateSession()`

Add to `backend/internal/modules/galacta/service.go`:

```go
type CreateSessionRequest struct {
    WorkspaceID string // gnz workspace ID (stored in gnz DB only)
    Name        string // display name
    WorkingDir  string // absolute path
    Model       string // optional, empty = galacta default
    InitialMsg  string // optional — if set, POSTs to /sessions/{id}/run after creation
}

type CreateSessionResult struct {
    Session    *Session // persisted in gnz DB
    NeedsInput bool     // true when InitialMsg was empty (session created, waiting for user input)
}

// CreateSession calls Galacta to create a session, persists it in gnz DB,
// and optionally sends an initial message to start the agent running.
func (s *Service) CreateSession(store *Store, req CreateSessionRequest) (*CreateSessionResult, error)
```

**Behaviour:**
1. POST `http://127.0.0.1:{port}/sessions` with `{ working_dir, model }` → get back `{ id, working_dir, model }`.
2. Build `galacta.Session{ID, WorkspaceID, Name, WorkingDir, Model}` and call `store.Upsert()`.
3. If `InitialMsg != ""`: POST `http://127.0.0.1:{port}/sessions/{id}/run` with `{ prompt: InitialMsg }`.
   - This is fire-and-forget (the agent streams via SSE separately); errors are logged but not fatal.
   - Set `NeedsInput = false`.
4. If `InitialMsg == ""`: set `NeedsInput = true` (session sits idle, user types first).
5. Return the result.

The kanban launch handler calls this method with the assembled prompt as `InitialMsg`.
The existing `CreateSession` HTTP handler in `handler.go` continues to proxy raw bodies to Galacta
unchanged — it does NOT call this new method. The new method is only for internal (Go-to-Go) use.

---

## Schema (10 migrations, numbered 010–019)

### 010_create_kanban_boards.sql
```sql
CREATE TABLE IF NOT EXISTS kanban_boards (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'My Board',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
```

### 011_create_kanban_columns.sql
```sql
CREATE TABLE IF NOT EXISTS kanban_columns (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
);
```

Default columns seeded when a board is created: Triage (0), Todo (1), Doing (2), Blocked (3), Review (4), Done (5).

### 012_create_kanban_cards.sql
```sql
CREATE TABLE IF NOT EXISTS kanban_cards (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'could',   -- would|could|should|must
    position REAL NOT NULL DEFAULT 0,         -- fractional for gap-based ordering
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (column_id) REFERENCES kanban_columns(id) ON DELETE RESTRICT
);
```

**Position strategy:** fractional (REAL). New card at end = `MAX(position) + 1.0`. Card dropped between A and B = `(A.position + B.position) / 2.0`. No reindexing needed. If the gap shrinks below `0.0001`, reindex that column's cards with `1.0, 2.0, 3.0, ...` (rare, one extra UPDATE in that case only).

### 013_create_kanban_labels.sql
```sql
CREATE TABLE IF NOT EXISTS kanban_labels (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(board_id, name),
    FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kanban_card_labels (
    card_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY (card_id, label_id),
    FOREIGN KEY (card_id) REFERENCES kanban_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES kanban_labels(id) ON DELETE CASCADE
);
```

### 014_create_kanban_subtasks.sql
```sql
CREATE TABLE IF NOT EXISTS kanban_subtasks (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    deliverable TEXT NOT NULL DEFAULT '',        -- written by agent via MCP
    session_id TEXT,                              -- galacta_sessions.id once launched
    status TEXT NOT NULL DEFAULT 'pending',      -- pending|running|done
    position REAL NOT NULL DEFAULT 0,            -- fractional, same strategy as cards
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES kanban_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES galacta_sessions(id) ON DELETE SET NULL
);

-- Which sub-tasks should be injected as context into this sub-task
CREATE TABLE IF NOT EXISTS kanban_subtask_context (
    subtask_id TEXT NOT NULL,
    depends_on_id TEXT NOT NULL,
    PRIMARY KEY (subtask_id, depends_on_id),
    FOREIGN KEY (subtask_id) REFERENCES kanban_subtasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_id) REFERENCES kanban_subtasks(id) ON DELETE CASCADE
);
```

---

## Backend Module — `backend/internal/modules/kanban/`

### Files
```
module.go          — Register(router) + RegisterMCPTools(srv)
models.go          — Board, Column, Card, Label, Subtask structs
store.go           — All DB queries
handler.go         — HTTP handlers
mcp_tools.go       — MCP tool registrations
```

### HTTP Routes (all under `/api/v1`)

All routes use flat registration (no nested `r.Route` blocks) per the Chi gotcha.

#### Boards
- `GET    /workspaces/{ws}/kanban/boards`
- `POST   /workspaces/{ws}/kanban/boards`
- `GET    /workspaces/{ws}/kanban/boards/{board}`
- `PUT    /workspaces/{ws}/kanban/boards/{board}`
- `DELETE /workspaces/{ws}/kanban/boards/{board}`

#### Columns (board-scoped)
- `GET    /workspaces/{ws}/kanban/boards/{board}/columns`
- `POST   /workspaces/{ws}/kanban/boards/{board}/columns`
- `PUT    /workspaces/{ws}/kanban/boards/{board}/columns/{col}`    — rename, reorder, toggle `visible`
- `DELETE /workspaces/{ws}/kanban/boards/{board}/columns/{col}`

#### Cards
- `GET    /workspaces/{ws}/kanban/boards/{board}/cards`            — returns all cards with labels
- `POST   /workspaces/{ws}/kanban/boards/{board}/cards`
- `GET    /workspaces/{ws}/kanban/boards/{board}/cards/{card}`
- `PUT    /workspaces/{ws}/kanban/boards/{board}/cards/{card}`     — full update (title, desc, priority, column_id, position)
- `DELETE /workspaces/{ws}/kanban/boards/{board}/cards/{card}`

#### Labels
- `GET    /workspaces/{ws}/kanban/boards/{board}/labels?q=`        — search for autocomplete
- `POST   /workspaces/{ws}/kanban/boards/{board}/labels`           — create label
- `POST   /workspaces/{ws}/kanban/boards/{board}/cards/{card}/labels`         — attach label
- `DELETE /workspaces/{ws}/kanban/boards/{board}/cards/{card}/labels/{label}` — detach label

#### Sub-tasks
- `GET    /workspaces/{ws}/kanban/cards/{card}/subtasks`
- `POST   /workspaces/{ws}/kanban/cards/{card}/subtasks`
- `PUT    /workspaces/{ws}/kanban/cards/{card}/subtasks/{sub}`     — edit prompt/title/position/context deps
- `DELETE /workspaces/{ws}/kanban/cards/{card}/subtasks/{sub}`
- `POST   /workspaces/{ws}/kanban/cards/{card}/subtasks/{sub}/launch` — launch Galacta session, returns session record

#### Sub-task launch logic
1. Check all `depends_on` subtasks have `status = done`. If not, return 409 with list of blocking subtask IDs + titles.
2. Build the initial prompt:
   ```
   Task: {card.title}
   Description: {card.description}

   --- Sub-task ---
   {subtask.prompt}

   --- Context from dependencies ---
   [For each dep]: ### {dep.title}\n{dep.deliverable}

   --- Deliverable instruction ---
   When complete, call the MCP tool `kanban_update_deliverable` with subtask_id="{subtask.id}" and your result.
   ```
3. Call `galactaSvc.CreateSession(galactaStore, CreateSessionRequest{ WorkspaceID, Name: subtask.title, WorkingDir: workspace.WorkingDir, InitialMsg: prompt })`.
4. Store `session_id` on the subtask, set `status = running`.
5. Return the session record so the frontend can open a Galacta tab.

The handler receives `*galacta.Service` and `*galacta.Store` at registration time (passed from `main.go`).

### Module signature

```go
func Register(r chi.Router, store *Store, galactaSvc *galacta.Service, galactaStore *galacta.Store, wsSvc *workspace.Service)
```

`galactaSvc` and `galactaStore` may be nil when `cfg.Features.Galacta` is false — the launch
handler returns 503 in that case. All other handlers work normally.

---

## MCP Tools

Registered via `RegisterMCPTools(srv, store, galactaSvc, galactaStore)` called from `mcp/server.go`,
alongside the existing database and actions tools. All tools are workspace-aware (accept `workspace_id` param).

| Tool | Description |
|------|-------------|
| `kanban_list_boards` | List boards in a workspace |
| `kanban_get_board` | Get full board (columns + cards + labels) |
| `kanban_create_card` | Create a card |
| `kanban_update_card` | Update title/desc/priority/column_id/position |
| `kanban_move_card` | Move card to column (and position) |
| `kanban_list_subtasks` | List sub-tasks for a card |
| `kanban_create_subtask` | Create a sub-task |
| `kanban_launch_subtask` | Launch the Galacta session for a sub-task |
| `kanban_update_deliverable` | **Agent-facing**: write deliverable result for a sub-task, set `status=done` |

`kanban_update_deliverable` is the only tool an agent running inside a sub-task session calls back.
It does not require a workspace_id — the subtask_id is globally unique and self-identifying.

---

## Frontend Module — `ui/src/modules/kanban/`

### Structure
```
register.ts
index.ts
components/
  KanbanPanel.tsx           — sidebar panel: board selector, column visibility toggles
  KanbanBoard.tsx           — main board view (columns + cards)
  KanbanColumn.tsx          — a single column with drag-drop drop zone
  KanbanCard.tsx            — card tile (drag handle, priority badge, labels, sub-task count)
  CardDetailModal.tsx       — full card editor modal (title, desc, priority, labels, sub-tasks)
  SubtaskList.tsx           — list of sub-tasks in card detail
  SubtaskItem.tsx           — individual sub-task row with launch button, open-session button
  LabelPicker.tsx           — searchable label input with create-on-type
  PriorityBadge.tsx         — would/could/should/must chip
stores/
  kanban-store.ts           — Zustand store
```

### Tab registration
- Module ID: `kanban`
- Icon: `LayoutDashboard` (lucide)
- Panel: `KanbanPanel` (column visibility toggles, board management)
- Tab type: `kanban-board` — renders `KanbanBoard`

### Drag and drop
- Browser native drag API (no library).
- Cards are `draggable`. Columns are drop zones.
- On drop: compute new position as midpoint between neighbours (fractional). Call `PUT /cards/{card}` with new `column_id` and `position`.
- Optimistic update in store, revert on error.

### Card detail modal
- Opens on card click.
- Inline editable: title (input), description (textarea), priority (segmented control: would/could/should/must), labels (LabelPicker).
- Sub-tasks section:
  - List of sub-tasks with title, status chip, prompt preview.
  - "Add sub-task" button: opens inline form (title, prompt, context deps multi-select from sibling sub-tasks).
  - Each sub-task row:
    - "Launch" button: disabled if any deps have `status != done`, tooltip names blockers. On click calls `POST .../subtasks/{sub}/launch`.
    - "Open session" button (only visible when `session_id != null`): opens a `galacta-session` tab.
- All edits auto-save on blur or debounced 500 ms.

### Column visibility
- Toggled via the panel sidebar (toggle switches per column).
- Calls `PUT /workspaces/{ws}/kanban/boards/{board}/columns/{col}` with `{ visible: true/false }`.
- Store carries `boardId` in the `toggleColumnVisibility` action.

### Store (kanban-store.ts)
```ts
interface KanbanStore {
  boards: Board[]
  activeBoard: Board | null
  columns: Column[]
  cards: Card[]        // all cards for active board
  labels: Label[]

  loadBoard(workspaceId: string, boardId: string): Promise<void>
  moveCard(cardId: string, toColumnId: string, toPosition: number): Promise<void>
  updateCard(cardId: string, patch: Partial<Card>): Promise<void>
  toggleColumnVisibility(boardId: string, colId: string, visible: boolean): Promise<void>
  launchSubtask(workspaceId: string, cardId: string, subtaskId: string): Promise<GalactaSession>
  // ... full CRUD for cards, columns, labels, subtasks
}
```

### Opening a session tab
When "Open session" is clicked on a sub-task:
```ts
tabRegistry.openTab({
  type: 'galacta-session',
  title: subtask.title,
  data: { sessionId: subtask.session_id, workspaceId }
})
```
Matches the existing `galacta-session` tab type registered in `ui/src/modules/galacta/register.ts`.

---

## Wiring

### Backend `main.go`
```go
import "github.com/clusterlab-ai/gnz/backend/internal/modules/kanban"

// After galacta registration block:
kanbanStore := kanban.NewStore(db)
srv.RegisterModuleRoutes(func(r chi.Router) {
    // galactaSvc and galactaStore are nil when Features.Galacta is false — handler guards internally
    kanban.Register(r, kanbanStore, galactaSvc, galactaStore, wsSvc)
})
```

`galactaStore` is the `*galacta.Store` already created inside `galacta.Register()`. Extract it to a
local variable in `main.go` so it can be passed here too:
```go
galactaStore := galacta.NewStore(db)
galacta.RegisterWithStore(r, galactaSvc, galactaStore)  // rename Register → RegisterWithStore, or just expose NewStore publicly and call it twice — they share the same *sql.DB so there's no state duplication.
```
Simplest: call `galacta.NewStore(db)` a second time in `main.go` and pass it to kanban. Two `Store`
values pointing at the same `*sql.DB` is safe.

### MCP server (`mcp/server.go`)
Update `New(...)` signature to accept kanban deps:
```go
func New(wsSvc, pool, connStore, actionsStore, actionsMgr, kanbanStore, galactaSvc, galactaStore) (*MCPServer, error)
```
Add inside:
```go
kanban.RegisterMCPTools(srv, kanbanStore, galactaSvc, galactaStore)
```

Update the call site in `main.go` accordingly.

### Frontend `main.tsx`
```ts
import { registerKanbanModule } from './modules/kanban/register';
// after registerActionsModule():
registerKanbanModule();
```

---

## Default Board bootstrapping

`GET /workspaces/{ws}/kanban/boards` auto-creates one board ("My Board") with the 6 default
columns (Triage, Todo, Doing, Blocked, Review, Done at positions 0–5) if the workspace has no
boards. Returns the auto-created board in the list. The frontend handles the 0-boards case
gracefully (spinner → auto-board appears in the response, no separate "Create board" prompt needed
unless the user later deletes all boards).

---

## Implementation Order

1. **`galacta.Service.CreateSession()`** — add to `service.go`, no new files
2. **DB migrations** (010–014)
3. **Backend models + store** (`models.go`, `store.go`)
4. **Backend HTTP handlers + `module.go`**
5. **Backend MCP tools** (`mcp_tools.go`)
6. **Wire into `main.go` + `mcp/server.go`**
7. **Frontend store** (`kanban-store.ts`)
8. **Frontend board + column + card components**
9. **Frontend card detail modal + sub-task UI**
10. **Frontend panel + register**
11. **Wire into `main.tsx`**

---

## Out of scope (this PR)
- Board archiving/deletion UI
- Due dates
- Card activity log / comments
- File attachments
