package terminal

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/google/uuid"
)

type RunningTerminal struct {
	session *TerminalSession
	pty     *os.File
	cmd     *exec.Cmd
	cancel  context.CancelFunc
	events  chan []byte
	done    chan struct{}
}

type Manager struct {
	mu        sync.RWMutex
	terminals map[string]*RunningTerminal
}

func NewManager() *Manager {
	return &Manager{
		terminals: make(map[string]*RunningTerminal),
	}
}

func (m *Manager) Create(workspaceID, name, cwd string, cols, rows uint16) (*TerminalSession, error) {
	if cwd == "" {
		cwd = os.Getenv("HOME")
	}
	if info, err := os.Stat(cwd); err != nil || !info.IsDir() {
		return nil, fmt.Errorf("invalid working directory %q", cwd)
	}

	shell := detectShell()
	if cols == 0 {
		cols = 80
	}
	if rows == 0 {
		rows = 24
	}

	id := uuid.New().String()
	if name == "" {
		name = fmt.Sprintf("Terminal %d", m.count()+1)
	}

	sess := &TerminalSession{
		ID:          id,
		WorkspaceID: workspaceID,
		Name:        name,
		Shell:       shell,
		Cwd:         cwd,
		Cols:        cols,
		Rows:        rows,
		Status:      StatusRunning,
		CreatedAt:   time.Now(),
	}

	ctx, cancel := context.WithCancel(context.Background())

	cmd := exec.CommandContext(ctx, shell, "-l")
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
	if err != nil {
		cancel()
		return nil, fmt.Errorf("starting pty: %w", err)
	}

	events := make(chan []byte, 256)
	done := make(chan struct{})

	rt := &RunningTerminal{
		session: sess,
		pty:     ptmx,
		cmd:     cmd,
		cancel:  cancel,
		events:  events,
		done:    done,
	}

	m.mu.Lock()
	m.terminals[id] = rt
	m.mu.Unlock()

	log.Printf("[terminal:%s] spawned %s (cwd=%s, cols=%d, rows=%d)", id[:8], shell, cwd, cols, rows)

	// Read PTY output in background
	go func() {
		defer close(done)
		defer close(events)

		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				chunk := make([]byte, n)
				copy(chunk, buf[:n])
				select {
				case events <- chunk:
				default:
					// Drop if consumer is too slow
				}
			}
			if err != nil {
				log.Printf("[terminal:%s] read error: %v", id[:8], err)
				break
			}
		}

		_ = cmd.Wait()
		log.Printf("[terminal:%s] process exited", id[:8])

		m.mu.Lock()
		if rt, exists := m.terminals[id]; exists {
			rt.session.Status = StatusStopped
		}
		m.mu.Unlock()
	}()

	return sess, nil
}

func (m *Manager) List(workspaceID string) []*TerminalSession {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var sessions []*TerminalSession
	for _, rt := range m.terminals {
		if rt.session.WorkspaceID == workspaceID {
			sessions = append(sessions, rt.session)
		}
	}
	return sessions
}

func (m *Manager) Get(id string) *RunningTerminal {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.terminals[id]
}

func (m *Manager) Write(id string, data []byte) error {
	m.mu.RLock()
	rt, exists := m.terminals[id]
	m.mu.RUnlock()
	if !exists {
		return fmt.Errorf("terminal %s not found", id)
	}
	_, err := rt.pty.Write(data)
	return err
}

func (m *Manager) Resize(id string, cols, rows uint16) error {
	m.mu.RLock()
	rt, exists := m.terminals[id]
	m.mu.RUnlock()
	if !exists {
		return fmt.Errorf("terminal %s not found", id)
	}

	if err := pty.Setsize(rt.pty, &pty.Winsize{Cols: cols, Rows: rows}); err != nil {
		return fmt.Errorf("resizing pty: %w", err)
	}

	rt.session.Cols = cols
	rt.session.Rows = rows
	log.Printf("[terminal:%s] resized to %dx%d", id[:8], cols, rows)
	return nil
}

func (m *Manager) Kill(id string) error {
	m.mu.Lock()
	rt, exists := m.terminals[id]
	if !exists {
		m.mu.Unlock()
		return fmt.Errorf("terminal %s not found", id)
	}
	delete(m.terminals, id)
	m.mu.Unlock()

	log.Printf("[terminal:%s] killing", id[:8])
	rt.cancel()
	rt.pty.Close()
	<-rt.done
	return nil
}

func (m *Manager) Shutdown() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, rt := range m.terminals {
		log.Printf("[terminal:%s] shutting down", id[:8])
		rt.cancel()
		rt.pty.Close()
		<-rt.done
		delete(m.terminals, id)
	}
}

func (m *Manager) count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.terminals)
}

func detectShell() string {
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell
	}
	if runtime.GOOS == "darwin" {
		return "/bin/zsh"
	}
	return "/bin/bash"
}
