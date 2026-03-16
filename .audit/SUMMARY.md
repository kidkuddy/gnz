# gnz — Audit Summary

_Audited: 2026-03-06 | Mode: standard_

## TL;DR

gnz is a well-structured modular desktop IDE (Go + Tauri + React) with 8 functional modules, clean separation of concerns, and an MCP-first design that's rare and forward-thinking. The architecture is solid for its current scale but has **3 critical security vulnerabilities** (SQL injection, command injection), **no tests**, and **no formal module abstraction** — the module pattern exists by convention only. The MCP-first vision is partially realized: 3 of 8 modules expose MCP tools.

## Risk Score: 5/10

| Dimension | Score | Notes |
|-----------|-------|-------|
| Architecture | 3/10 | Clean module pattern, sustainable to ~15 modules |
| Correctness | 5/10 | Works but no tests, inconsistent error handling |
| Security | 7/10 | 3 critical injection vectors, no auth (by design), world-readable temp files |
| Operability | 5/10 | No CI, no health checks, incomplete graceful shutdown |
| Changeability | 4/10 | Good module isolation, but no shared validation/error patterns; adding modules requires touching 4+ files |

_(1 = pristine, 10 = rewrite candidate)_

## Scopes

| Scope | Path | Type | State | Lines |
|-------|------|------|-------|-------|
| Backend | `backend/` | Go HTTP sidecar | Ready, 8 modules active | ~7,500 |
| Desktop | `desktop/` | Tauri 2 Rust shell | Ready, thin proxy | ~360 |
| UI | `ui/` | React 19 SPA | Ready, 8 modules registered | ~12,850 |

## Findings Overview

| ID | Category | Severity | Location | Summary |
|----|----------|----------|----------|---------|
| SEC-001 | Security | CRITICAL | `database/tables.go:60,71,78` | SQL injection via `fmt.Sprintf` with table name |
| SEC-002 | Security | CRITICAL | `database/handler.go:174-181` | SQL injection via string concat in GetTableRows |
| SEC-003 | Security | CRITICAL | `actions/manager.go:80` | Command injection via shell `-lc` with user command |
| SEC-012 | Security | HIGH | `database/handler.go:192-230` | No query timeout on user SQL execution |
| SEC-004 | Security | HIGH | `git/handler.go:502` | Git command injection via branch name (no `--` separator) |
| SEC-007 | Security | HIGH | All endpoints | No authentication layer (CORS: `*`) |
| SEC-010 | Security | HIGH | `galacta/service.go` | Unsecured daemon, world-readable `/tmp` config, `pkill` cleanup |
| TEST-001 | Quality | HIGH | Entire codebase | Zero automated tests |
| SEC-008 | Security | MEDIUM | `main.go:166-169` | HTTP server missing Read/Write/Idle timeouts |
| SEC-011 | Security | MEDIUM | All endpoints | No rate limiting |
| SEC-005 | Security | MEDIUM | `files/handler.go:136-165` | Path traversal via symlinks (no `EvalSymlinks`) |
| SEC-006 | Security | MEDIUM | `git/handler.go:47-70` | Same symlink traversal issue |
| ERR-001 | Quality | MEDIUM | `git/executor.go:102`, `kanban/store.go:117+` | Swallowed errors in conversions/DB ops |
| ERR-004 | Quality | MEDIUM | `galacta/service.go:314` | Ignored SSE body read error |
| PERF-001 | Performance | MEDIUM | `actions/manager.go`, `galacta/service.go` | Unbounded log file growth in `/tmp` |
| PERF-003 | Performance | MEDIUM | `database/pool.go:50-51` | No `SetConnMaxLifetime` on connection pools |
| OPS-001 | Operations | MEDIUM | `main.go:171-193` | Graceful shutdown may orphan terminals/actions |
| ARCH-001 | Architecture | MEDIUM | All modules | No formal module interface/contract definition |
| ARCH-002 | Architecture | MEDIUM | 37 handler sites | Request validation scattered, inconsistent |
| ARCH-003 | Architecture | MEDIUM | `server/response.go` | Error responses are raw strings, no structured codes |
| SEC-009 | Security | LOW | `manager.go:21`, `service.go:21-22` | Predictable `/tmp` log paths |
| CONFIG-002 | Config | LOW | `galacta/service.go:20` | Hardcoded Galacta port 9090 |
| OPS-003 | Operations | LOW | All handlers | No request ID / trace correlation in logs |

## Top 5 Issues (by blast radius)

### 1. SQL Injection in Database Module — CRITICAL
- **What:** Table names interpolated into SQL via `fmt.Sprintf` and string concatenation
- **Why it matters:** Any user (or MCP agent) browsing tables can inject arbitrary SQL against connected databases
- **Fix:** Use parameterized queries where possible; for identifiers, validate against actual schema or use dialect-specific quoters
- **Effort:** S
- **Files:** `tables.go:60,71,78`, `handler.go:174-181`

### 2. Command Injection in Actions Module — CRITICAL
- **What:** User-provided command string passed to `sh -lc` without any sanitization
- **Why it matters:** Actions are the primary way to run commands — this is by design, but there's no guardrail against MCP agents creating malicious actions
- **Fix:** Document that actions execute arbitrary commands; add confirmation UI; consider MCP tool permission levels
- **Effort:** S (documentation + MCP guard) to M (full sandboxing)
- **Files:** `actions/manager.go:80`, `actions/handler.go:49`

### 3. No Automated Tests — HIGH
- **What:** Zero tests across all three scopes
- **Why it matters:** Every change is a regression risk; security fixes can't be verified; refactoring is dangerous
- **Fix:** Add handler-level tests for critical paths (database query, actions execution, file read)
- **Effort:** M

### 4. No Module Abstraction / Contract — MEDIUM (architectural)
- **What:** Module pattern exists by convention only — no interface, no registry, no lifecycle hooks
- **Why it matters:** This is the core of your product vision. Without a formal `Module` interface, you can't: auto-discover modules, enforce MCP tool registration, generate module docs, or let users enable/disable modules at runtime
- **Fix:** Define `Module` interface in Go (`Register`, `RegisterMCPTools`, `Metadata`) and `ModuleDefinition` type in TypeScript; create registry that enforces the contract
- **Effort:** M

### 5. MCP Coverage Gap — MEDIUM (vision)
- **What:** Only 3/8 backend modules expose MCP tools (database, actions, kanban). Git, terminal, scratchpad, files, and galacta sessions have no MCP tools.
- **Why it matters:** "MCP-first" is the stated design goal — agents currently can't do git operations, read files, or manage terminals
- **Fix:** Add MCP tools for remaining modules, prioritizing git and files (most useful for agents)
- **Effort:** M

## Verdict: **Keep + Refactor**

The architecture is sound and the module pattern is clean. This is NOT a rewrite candidate. The codebase needs:
1. **Security hardening** (injection fixes — small, targeted PRs)
2. **Formal module contract** (the missing abstraction that would unlock the MCP-first vision)
3. **Test foundation** (even basic handler tests would dramatically reduce risk)

The code is ~20K lines across 3 languages with good separation. The module pattern scales. The MCP-first vision is the differentiator — lean into it.

## Recommended Next Actions (ordered by priority)

1. **Fix SQL injection in database module** — Parameterize or validate table names in `tables.go` and `handler.go`. One PR.

2. **Add query timeout** — Wrap user SQL execution in `context.WithTimeout(ctx, 30*time.Second)`. One PR.

3. **Fix git command injection** — Add `--` separator before user-provided branch/ref names. One PR.

4. **Define formal Module interface (Go)** — Create `internal/module/module.go` with `Module` interface: `ID()`, `Register(chi.Router)`, `RegisterMCPTools(*MCPServer)`, `Metadata() ModuleMeta`. Refactor existing modules to implement it. One PR.

5. **Add MCP tools for git and files modules** — These are the most useful for AI agents. Two PRs.

6. **Set HTTP server timeouts** — Add `ReadTimeout: 30s`, `WriteTimeout: 0` (for SSE), `IdleTimeout: 120s`. One PR.

7. **Add basic handler tests** — Start with database query execution and actions manager. One PR per module.

8. **Resolve symlink traversal** — Add `filepath.EvalSymlinks()` in files and git path validation. One PR.

9. **Move temp files to app data dir** — Replace `/tmp/gnz-*` with `~/Library/Application Support/com.gnz.app/logs/`. One PR.

10. **Explore MCP as internal transport** — Prototype replacing HTTP API with MCP for UI↔backend communication. This would make gnz truly MCP-native: same protocol for agents and humans. Research spike, not a PR yet.

## User Notes Response

### "MCP-first — every feature should have an MCP server"
**Current state:** 3/8 modules have MCP tools (database, actions, kanban). Git, terminal, scratchpad, files, galacta are missing.
**Gap:** No enforcement mechanism — modules can skip MCP registration without any error or warning.
**Recommendation:** The formal Module interface (action #4) should make `RegisterMCPTools` required (even if it's a no-op). Then add MCP tools to remaining modules incrementally.

### "Module abstraction — how to define a module"
**Current state:** Convention-only. Backend: `module.go` with `Register()` function. Frontend: `register.ts` with `tabRegistry.registerModule()`. No shared interface, no registry, no lifecycle.
**What a module should be:**
- **Backend:** `Module` interface with `ID`, `Register(router)`, `RegisterMCPTools(server)`, `Metadata()` (name, description, feature flag, dependencies)
- **Frontend:** `ModuleDefinition` type with `id`, `label`, `icon`, `panelComponent`, `tabDefinitions`, `mcpTools` (for documentation)
- **Registry:** Both sides should have a registry that validates and lists all modules
- **This is the single most impactful architectural change you can make.**

### "Fully MCP-based internal communication?"
**Current assessment:** Interesting but premature. MCP is request/response with tool calls — it works for discrete operations but is awkward for:
- SSE streaming (terminal output, action logs, galacta sessions)
- Bidirectional communication (terminal input)
- High-frequency updates (typing in scratchpad)

**Recommended approach:** Keep HTTP for streaming/bidirectional, but route all discrete CRUD operations through MCP internally. This gives you one protocol for agents AND a simpler internal API. Start with a prototype: make the UI call MCP tools instead of REST for one module (kanban is a good candidate — it's pure CRUD).

### "Feature flags vs modules"
**Current state:** Feature flags exist (`config.go`) but are disconnected from modules. Flags are checked in `main.go` before registration, not by the module system.
**Recommendation:** Merge them. Each `Module` should declare its feature flag. The registry checks the flag and skips registration if disabled. This eliminates the manual wiring in `main.go` and makes modules truly self-describing.
