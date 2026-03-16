# gnz — Findings

_Audited: 2026-03-06 | Mode: standard_

---

## Security (SEC)

| ID | Severity | Location | Description | Fix |
|----|----------|----------|-------------|-----|
| SEC-001 | CRITICAL | `backend/internal/modules/database/tables.go:60,71,78` | SQL injection: table name interpolated via `fmt.Sprintf` into queries without escaping | Use parameterized queries or validate table names against actual schema |
| SEC-002 | CRITICAL | `backend/internal/modules/database/handler.go:174-181` | SQL injection: table name concatenated into SELECT with fragile quoting | Same as SEC-001; use dialect-specific identifier quoter |
| SEC-003 | CRITICAL | `backend/internal/modules/actions/manager.go:80` | Command injection: `action.Command` passed to `sh -lc` without sanitization | Document as admin-only; add MCP permission levels; consider sandboxing |
| SEC-004 | HIGH | `backend/internal/modules/git/handler.go:502` | Git command injection: branch name passed without `--` separator | Add `--` before user-provided branch/ref names in all git commands |
| SEC-007 | HIGH | All backend endpoints | No authentication layer; CORS allows `*` | Document single-user design; restrict CORS to localhost; add optional auth middleware |
| SEC-010 | HIGH | `backend/internal/modules/galacta/service.go` | Unsecured daemon: `pkill` cleanup, world-readable `/tmp/galacta-mcp.json`, no auth on port 9090 | Use PID-based cleanup; move config to app data dir; add auth token |
| SEC-012 | HIGH | `backend/internal/modules/database/handler.go:192-230` | No query timeout on user SQL execution; queries can hang indefinitely | Wrap in `context.WithTimeout(ctx, 30*time.Second)` |
| SEC-005 | MEDIUM | `backend/internal/modules/files/handler.go:136-165` | Path traversal via symlinks: checks `..` and prefix but doesn't resolve symlinks | Add `filepath.EvalSymlinks()` before prefix check |
| SEC-006 | MEDIUM | `backend/internal/modules/git/handler.go:47-70` | Same symlink traversal as SEC-005 | Same fix |
| SEC-008 | MEDIUM | `backend/cmd/gnz-backend/main.go:166-169` | HTTP server has no Read/Write/Idle timeouts | Set `ReadTimeout: 30s`, `WriteTimeout: 0` (SSE), `IdleTimeout: 120s` |
| SEC-011 | MEDIUM | All endpoints | No rate limiting; expensive operations unprotected | Add rate limiter middleware |
| SEC-009 | LOW | `backend/internal/modules/actions/manager.go:21`, `galacta/service.go:21-22` | Predictable `/tmp` paths for logs; world-readable on multi-user systems | Use app data dir instead of `/tmp` |

## Performance (PERF)

| ID | Severity | Location | Description | Fix |
|----|----------|----------|-------------|-----|
| PERF-001 | MEDIUM | `backend/internal/modules/actions/manager.go`, `galacta/service.go` | Unbounded log file growth in `/tmp`; no rotation or size limits | Implement log rotation or max file size |
| PERF-003 | MEDIUM | `backend/internal/modules/database/pool.go:50-51` | No `SetConnMaxLifetime` on external DB connection pools | Add `db.SetConnMaxLifetime(5 * time.Minute)` |
| PERF-002 | LOW | `backend/internal/modules/terminal/manager.go:187-202` | PTY file handles orphaned on backend crash | Already handled by graceful shutdown; document risk |
| PERF-004 | LOW | `backend/internal/modules/galacta/service.go:213-218` | Entire log file read into memory for /logs endpoint | Stream tail of file instead |
| PERF-005 | LOW | `backend/internal/modules/terminal/manager.go:114-118` | Channel drops output on slow consumer (buffer 256); no metrics | Track drop count; expose via stats endpoint |

## Quality (QUAL)

| ID | Severity | Location | Description | Fix |
|----|----------|----------|-------------|-----|
| TEST-001 | HIGH | Entire codebase | Zero automated tests across all scopes | Add handler-level tests for critical paths |
| ERR-001 | MEDIUM | `backend/internal/modules/git/executor.go:102-103`, `kanban/store.go:117,398,404-405,570,598` | Swallowed errors: `_, _ = s.db.Exec(...)`, `_ = strconv.Atoi(...)` | Handle or log all errors explicitly |
| ERR-004 | MEDIUM | `backend/internal/modules/galacta/service.go:314` | Ignored SSE body read error (`//nolint:errcheck`) | Handle error or document why it's safe to ignore |
| ERR-002 | LOW | `backend/internal/modules/galacta/handler.go:118` | `_ = json.Unmarshal(body, &req)` — parse failure uses zero values | Return 400 on unmarshal failure |
| ERR-003 | LOW | `backend/internal/modules/galacta/handler.go:86,95` | `rawBody, _ := io.ReadAll(galactaResp.Body)` — read error discarded | Log error; return 502 if body can't be read |

## Architecture (ARCH)

| ID | Severity | Location | Description | Fix |
|----|----------|----------|-------------|-----|
| ARCH-001 | MEDIUM | All modules | No formal Module interface; pattern exists by convention only | Define `Module` interface with `ID`, `Register`, `RegisterMCPTools`, `Metadata` |
| ARCH-002 | MEDIUM | 37 handler sites | Request validation scattered; inconsistent error messages and defaults | Create shared `DecodeAndValidate` helper |
| ARCH-003 | MEDIUM | `backend/internal/server/response.go` | Error responses are raw strings; no structured error codes | Extend envelope: `error: {code, message, details}` |
| ARCH-004 | MEDIUM | `backend/internal/modules/kanban/handler.go` + `mcp_tools.go` | Subtask launch logic duplicated in HTTP handler and MCP tool | Extract to shared service method |
| ARCH-005 | LOW | `backend/cmd/gnz-backend/main.go` | Feature flags checked manually before module registration; not part of module definition | Make feature flag a property of Module interface |
| ARCH-006 | LOW | 5 modules | MCP tools missing for git, terminal, scratchpad, files, galacta sessions | Add MCP tools incrementally |

## Configuration (CFG)

| ID | Severity | Location | Description | Fix |
|----|----------|----------|-------------|-----|
| CFG-001 | LOW | `backend/internal/config/config.go` | Feature flags env-var only; no config file support | Add optional config file (TOML/YAML) |
| CFG-002 | LOW | `backend/internal/modules/galacta/service.go:20` | Galacta daemon port hardcoded to 9090 | Make configurable via env var |

## Operations (OPS)

| ID | Severity | Location | Description | Fix |
|----|----------|----------|-------------|-----|
| OPS-001 | MEDIUM | `backend/cmd/gnz-backend/main.go:171-193` | Graceful shutdown may fail; galacta killed via `pkill`; terminals may leak | Use PID-based cleanup; add shutdown hooks per module |
| OPS-002 | LOW | All endpoints | No health check beyond `/ping`; doesn't verify module health | Add `/health` endpoint that checks appdb + module status |
| OPS-003 | LOW | All handlers | No request ID / trace correlation in logs | Add request ID middleware; include in all log lines |

---

## Finding Counts

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 5 |
| Medium | 14 |
| Low | 12 |
| Info | 0 |
| **Total** | **34** |
