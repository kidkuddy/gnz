package claude

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync"
)

// RunningProcess holds the state for an active claude subprocess.
type RunningProcess struct {
	cmd    *exec.Cmd
	cancel context.CancelFunc
	events chan string // raw JSON lines from stdout
	done   chan struct{}
}

// Manager manages claude CLI subprocesses, one per session at a time.
type Manager struct {
	mu        sync.RWMutex
	processes map[string]*RunningProcess
	svc       *Service
}

func NewManager(svc *Service) *Manager {
	return &Manager{
		processes: make(map[string]*RunningProcess),
		svc:       svc,
	}
}

// SendMessage spawns a claude subprocess for the given session and streams output.
// If a process is already running for this session, it returns an error.
func (m *Manager) SendMessage(sess *Session, text string) (<-chan string, error) {
	m.mu.Lock()
	if _, exists := m.processes[sess.ID]; exists {
		m.mu.Unlock()
		return nil, fmt.Errorf("session %s already has a running process", sess.ID)
	}

	// Resolve claude binary path
	claudePath, err := exec.LookPath("claude")
	if err != nil {
		m.mu.Unlock()
		log.Printf("[claude:%s] ERROR: claude binary not found in PATH: %v", sess.ID[:8], err)
		return nil, fmt.Errorf("claude binary not found in PATH: %w", err)
	}
	log.Printf("[claude:%s] using binary: %s", sess.ID[:8], claudePath)

	// Validate working directory
	if info, err := os.Stat(sess.WorkingDirectory); err != nil || !info.IsDir() {
		m.mu.Unlock()
		log.Printf("[claude:%s] ERROR: invalid working directory %q: %v", sess.ID[:8], sess.WorkingDirectory, err)
		return nil, fmt.Errorf("invalid working directory %q: %w", sess.WorkingDirectory, err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	args := []string{
		"-p", text,
		"--output-format", "stream-json",
		"--verbose",
		"--model", sess.Model,
		"--yes",
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

	events := make(chan string, 256)
	done := make(chan struct{})

	proc := &RunningProcess{
		cmd:    cmd,
		cancel: cancel,
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
			events <- line
		}
		if err := scanner.Err(); err != nil {
			log.Printf("[claude:%s] stdout scanner error: %v", sess.ID[:8], err)
		}

		// Wait for process to finish
		exitErr := cmd.Wait()
		if exitErr != nil {
			log.Printf("[claude:%s] process exited with error: %v", sess.ID[:8], exitErr)
		} else {
			log.Printf("[claude:%s] process exited cleanly (lines read: %d)", sess.ID[:8], lineCount)
		}

		// Cleanup
		m.cleanup(sess.ID)
		_ = m.svc.SetStatus(sess.ID, StatusIdle)
	}()

	return events, nil
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
