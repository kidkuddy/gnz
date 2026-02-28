package claude

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

// RunningProcess holds the state for an active claude subprocess.
type RunningProcess struct {
	cmd    *exec.Cmd
	cancel context.CancelFunc
	stdin  io.WriteCloser
	events chan string // raw JSON lines from stdout
	done   chan struct{}
}

// Manager manages claude CLI subprocesses, one per session at a time.
type Manager struct {
	mu        sync.RWMutex
	processes map[string]*RunningProcess
	svc       *Service
	port      int // backend HTTP port, used to build MCP config for Claude sessions
}

func NewManager(svc *Service, port int) *Manager {
	return &Manager{
		processes: make(map[string]*RunningProcess),
		svc:       svc,
		port:      port,
	}
}

// Start spawns a claude process without an initial prompt (alive mode).
// The process stays running and waits for stdin input.
func (m *Manager) Start(sess *Session) (<-chan string, error) {
	return m.spawnProcess(sess, "")
}

// SendMessage spawns a claude process with an initial prompt (fire-and-go mode).
// The process runs until the prompt is fully answered, then exits.
func (m *Manager) SendMessage(sess *Session, text string) (<-chan string, error) {
	return m.spawnProcess(sess, text)
}

// SendText writes a user text message to the stdin of a running session's process.
func (m *Manager) SendText(sessionID, text, claudeSessionID string) error {
	msg := map[string]any{
		"type": "user",
		"message": map[string]any{
			"role": "user",
			"content": []map[string]any{
				{"type": "text", "text": text},
			},
		},
		"session_id":         claudeSessionID,
		"parent_tool_use_id": nil,
	}
	payload, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshalling stdin message: %w", err)
	}
	log.Printf("[claude:%s] sending text via stdin (%d bytes)", sessionID[:8], len(payload))
	return m.Respond(sessionID, payload)
}

// spawnProcess is the shared implementation for Start and SendMessage.
func (m *Manager) spawnProcess(sess *Session, text string) (<-chan string, error) {
	m.mu.Lock()
	if _, exists := m.processes[sess.ID]; exists {
		m.mu.Unlock()
		return nil, fmt.Errorf("session %s already has a running process", sess.ID)
	}

	// Resolve claude binary path — macOS .app bundles have a minimal PATH,
	// so we check common install locations before falling back to LookPath.
	claudePath := resolveClaudeBinary()
	if claudePath == "" {
		m.mu.Unlock()
		log.Printf("[claude:%s] ERROR: claude binary not found", sess.ID[:8])
		return nil, fmt.Errorf("claude binary not found — install Claude Code CLI or set PATH")
	}
	log.Printf("[claude:%s] using binary: %s", sess.ID[:8], claudePath)

	// Validate working directory
	if info, err := os.Stat(sess.WorkingDirectory); err != nil || !info.IsDir() {
		m.mu.Unlock()
		log.Printf("[claude:%s] ERROR: invalid working directory %q: %v", sess.ID[:8], sess.WorkingDirectory, err)
		return nil, fmt.Errorf("invalid working directory %q: %w", sess.WorkingDirectory, err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	permMode := sess.PermissionMode
	if permMode == "" || !ValidPermissionModes[permMode] {
		permMode = "acceptEdits"
	}

	args := []string{
		"--output-format", "stream-json",
		"--input-format", "stream-json",
		"--verbose",
		"--model", sess.Model,
		"--permission-mode", permMode,
	}

	// For non-bypass modes, use stdio-based permission prompts so the UI can handle them
	if permMode != "bypassPermissions" {
		args = append(args, "--permission-prompt-tool", "stdio")
	}

	// Only add -p if there's initial text (fire-and-go mode)
	if text != "" {
		args = append(args, "-p", text)
	}

	// Provide gnz MCP server to the Claude session
	var mcpConfigPath string
	if m.port > 0 {
		mcpConfigPath = filepath.Join(os.TempDir(), fmt.Sprintf("gnz-mcp-%s.json", sess.ID))
		mcpConfig := fmt.Sprintf(`{"mcpServers":{"gnz-devtools":{"type":"sse","url":"http://127.0.0.1:%d/mcp/sse"}}}`, m.port)
		if err := os.WriteFile(mcpConfigPath, []byte(mcpConfig), 0644); err != nil {
			log.Printf("[claude:%s] WARNING: failed to write MCP config: %v", sess.ID[:8], err)
			mcpConfigPath = ""
		} else {
			args = append(args, "--mcp-config", mcpConfigPath)
		}
	}

	// Resume existing claude session if we have one
	if sess.ClaudeSessionID != "" {
		args = append(args, "--resume", sess.ClaudeSessionID)
	}

	log.Printf("[claude:%s] spawning: claude %v (cwd=%s)", sess.ID[:8], args, sess.WorkingDirectory)

	cmd := exec.CommandContext(ctx, claudePath, args...)
	cmd.Dir = sess.WorkingDirectory

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		m.mu.Unlock()
		log.Printf("[claude:%s] ERROR: creating stdout pipe: %v", sess.ID[:8], err)
		return nil, fmt.Errorf("creating stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		m.mu.Unlock()
		log.Printf("[claude:%s] ERROR: creating stderr pipe: %v", sess.ID[:8], err)
		return nil, fmt.Errorf("creating stderr pipe: %w", err)
	}

	stdinPipe, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		m.mu.Unlock()
		log.Printf("[claude:%s] ERROR: creating stdin pipe: %v", sess.ID[:8], err)
		return nil, fmt.Errorf("creating stdin pipe: %w", err)
	}

	events := make(chan string, 256)
	done := make(chan struct{})

	proc := &RunningProcess{
		cmd:    cmd,
		cancel: cancel,
		stdin:  stdinPipe,
		events: events,
		done:   done,
	}

	m.processes[sess.ID] = proc
	m.mu.Unlock()

	if err := cmd.Start(); err != nil {
		m.cleanup(sess.ID)
		log.Printf("[claude:%s] ERROR: failed to start process: %v", sess.ID[:8], err)
		return nil, fmt.Errorf("starting claude process: %w", err)
	}

	log.Printf("[claude:%s] process started (pid=%d)", sess.ID[:8], cmd.Process.Pid)

	// Update session status
	_ = m.svc.SetStatus(sess.ID, StatusRunning)

	// Read stderr in background (for logging)
	go func() {
		scanner := bufio.NewScanner(stderr)
		scanner.Buffer(make([]byte, 0, 256*1024), 1024*1024)
		for scanner.Scan() {
			log.Printf("[claude:%s:stderr] %s", sess.ID[:8], scanner.Text())
		}
	}()

	// Read stdout line-by-line, push raw JSON lines to events channel
	go func() {
		defer close(done)
		defer close(events)

		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 0, 256*1024), 1024*1024)
		lineCount := 0
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}
			lineCount++
			log.Printf("[claude:%s:stdout] line %d: %.200s", sess.ID[:8], lineCount, line)
			select {
			case events <- line:
			case <-ctx.Done():
				return
			}
		}
		if err := scanner.Err(); err != nil {
			log.Printf("[claude:%s] stdout scanner error: %v", sess.ID[:8], err)
		}

		// Close stdin pipe
		stdinPipe.Close()

		// Wait for process to finish
		exitErr := cmd.Wait()
		if exitErr != nil {
			log.Printf("[claude:%s] process exited with error: %v", sess.ID[:8], exitErr)
		} else {
			log.Printf("[claude:%s] process exited cleanly (lines read: %d)", sess.ID[:8], lineCount)
		}

		// Remove temp MCP config
		if mcpConfigPath != "" {
			_ = os.Remove(mcpConfigPath)
		}

		// Cleanup
		m.cleanup(sess.ID)
		_ = m.svc.SetStatus(sess.ID, StatusIdle)
	}()

	return events, nil
}

// Respond writes a JSON payload to the stdin of a running session's process.
func (m *Manager) Respond(sessionID string, payload []byte) error {
	m.mu.RLock()
	proc, exists := m.processes[sessionID]
	m.mu.RUnlock()
	if !exists {
		return fmt.Errorf("no running process for session %s", sessionID)
	}
	_, err := proc.stdin.Write(append(payload, '\n'))
	return err
}

// Abort kills the running process for a session.
func (m *Manager) Abort(sessionID string) error {
	m.mu.RLock()
	proc, exists := m.processes[sessionID]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("no running process for session %s", sessionID)
	}

	log.Printf("[claude:%s] aborting process", sessionID[:8])
	proc.cancel()
	<-proc.done
	return nil
}

// IsRunning checks if a session has an active process.
func (m *Manager) IsRunning(sessionID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, exists := m.processes[sessionID]
	return exists
}

// Shutdown kills all running processes.
func (m *Manager) Shutdown() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, proc := range m.processes {
		log.Printf("[claude:%s] shutting down process", id[:8])
		proc.cancel()
		<-proc.done
		delete(m.processes, id)
	}
}

func (m *Manager) cleanup(sessionID string) {
	m.mu.Lock()
	delete(m.processes, sessionID)
	m.mu.Unlock()
}

// resolveClaudeBinary finds the claude CLI binary by checking common install
// locations first (needed for macOS .app bundles where PATH is minimal),
// then falling back to exec.LookPath.
func resolveClaudeBinary() string {
	home, _ := os.UserHomeDir()

	// Common install locations for claude CLI
	var candidates []string
	if runtime.GOOS == "darwin" || runtime.GOOS == "linux" {
		if home != "" {
			candidates = append(candidates,
				filepath.Join(home, ".local", "bin", "claude"),
				filepath.Join(home, ".npm-global", "bin", "claude"),
				filepath.Join(home, ".nvm", "current", "bin", "claude"),
			)
			// Check nvm versions directory for any node version
			nvmDir := filepath.Join(home, ".nvm", "versions", "node")
			if entries, err := os.ReadDir(nvmDir); err == nil {
				for _, e := range entries {
					if e.IsDir() && strings.HasPrefix(e.Name(), "v") {
						candidates = append(candidates, filepath.Join(nvmDir, e.Name(), "bin", "claude"))
					}
				}
			}
		}
		candidates = append(candidates,
			"/usr/local/bin/claude",
			"/opt/homebrew/bin/claude",
		)
	}

	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			return path
		}
	}

	// Fall back to PATH lookup
	if p, err := exec.LookPath("claude"); err == nil {
		return p
	}
	return ""
}
