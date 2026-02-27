package actions

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

const logDir = "/tmp/gnz-actions"

type RunningAction struct {
	run     *ActionRun
	cmd     *exec.Cmd
	cancel  context.CancelFunc
	events  chan string
	done    chan struct{}
	logFile *os.File
	mu      sync.Mutex
}

type Manager struct {
	mu      sync.RWMutex
	running map[string]*RunningAction // runID -> RunningAction
	store   *Store
	wsSvc   *workspace.Service
}

func NewManager(store *Store, wsSvc *workspace.Service) *Manager {
	os.MkdirAll(logDir, 0755)
	return &Manager{
		running: make(map[string]*RunningAction),
		store:   store,
		wsSvc:   wsSvc,
	}
}

func (m *Manager) Execute(action *Action) (*ActionRun, error) {
	cwd, err := m.resolveCwd(action)
	if err != nil {
		return nil, fmt.Errorf("resolving cwd: %w", err)
	}

	runID := uuid.New().String()

	// Create log file
	logPath := filepath.Join(logDir, runID+".log")
	logFile, err := os.Create(logPath)
	if err != nil {
		return nil, fmt.Errorf("creating log file: %w", err)
	}

	run := &ActionRun{
		ID:          runID,
		ActionID:    action.ID,
		WorkspaceID: action.WorkspaceID,
		Status:      StatusRunning,
		LogFile:     logPath,
	}

	if err := m.store.CreateRun(run); err != nil {
		logFile.Close()
		os.Remove(logPath)
		return nil, fmt.Errorf("creating run record: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	shell := detectShell()
	cmd := exec.CommandContext(ctx, shell, "-lc", action.Command)
	cmd.Dir = cwd
	cmd.Env = os.Environ()

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		logFile.Close()
		return nil, fmt.Errorf("creating stdout pipe: %w", err)
	}
	cmd.Stderr = cmd.Stdout // merge stderr into stdout

	if err := cmd.Start(); err != nil {
		cancel()
		logFile.Close()
		return nil, fmt.Errorf("starting command: %w", err)
	}

	events := make(chan string, 256)
	done := make(chan struct{})

	ra := &RunningAction{
		run:     run,
		cmd:     cmd,
		cancel:  cancel,
		events:  events,
		done:    done,
		logFile: logFile,
	}

	m.mu.Lock()
	m.running[run.ID] = ra
	m.mu.Unlock()

	log.Printf("[action:%s] started run %s (cmd=%q, cwd=%s, log=%s)", action.ID[:8], run.ID[:8], action.Command, cwd, logPath)

	go func() {
		defer close(done)
		defer close(events)
		defer logFile.Close()

		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text() + "\n"

			// Write to log file
			logFile.WriteString(line)

			select {
			case events <- line:
			default:
				// Drop if consumer is too slow
			}
		}

		exitCode := 0
		status := StatusCompleted
		waitErr := cmd.Wait()
		if waitErr != nil {
			if exitErr, ok := waitErr.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
				status = StatusFailed
			} else if ctx.Err() != nil {
				status = StatusKilled
				exitCode = -1
			} else {
				status = StatusFailed
				exitCode = 1
			}
		}

		now := time.Now().UTC()
		ra.mu.Lock()
		run.Status = status
		run.ExitCode = &exitCode
		run.FinishedAt = &now
		ra.mu.Unlock()

		if err := m.store.UpdateRun(run); err != nil {
			log.Printf("[action:%s] failed to update run %s: %v", action.ID[:8], run.ID[:8], err)
		}

		m.mu.Lock()
		delete(m.running, run.ID)
		m.mu.Unlock()

		log.Printf("[action:%s] run %s finished (status=%s, exit=%d)", action.ID[:8], run.ID[:8], status, exitCode)
	}()

	return run, nil
}

func (m *Manager) Kill(runID string) error {
	m.mu.RLock()
	ra, exists := m.running[runID]
	m.mu.RUnlock()
	if !exists {
		return fmt.Errorf("run %s not found or already finished", runID)
	}

	log.Printf("[action] killing run %s", runID[:8])
	ra.cancel()
	<-ra.done
	return nil
}

func (m *Manager) GetRunning(runID string) *RunningAction {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.running[runID]
}

func (m *Manager) ListRunning() []*ActionRun {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var runs []*ActionRun
	for _, ra := range m.running {
		ra.mu.Lock()
		r := *ra.run // copy
		ra.mu.Unlock()
		runs = append(runs, &r)
	}
	return runs
}

func (m *Manager) Shutdown() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, ra := range m.running {
		log.Printf("[action] shutting down run %s", id[:8])
		ra.cancel()
		<-ra.done
	}
}

func (m *Manager) resolveCwd(action *Action) (string, error) {
	ws, err := m.wsSvc.GetByID(action.WorkspaceID)
	if err != nil {
		return "", fmt.Errorf("getting workspace: %w", err)
	}

	wsDir := ""
	if ws != nil && ws.Settings != "" {
		var settings struct {
			WorkingDirectory string `json:"working_directory"`
		}
		if err := json.Unmarshal([]byte(ws.Settings), &settings); err == nil {
			wsDir = settings.WorkingDirectory
		}
	}

	if action.Cwd != "" {
		if filepath.IsAbs(action.Cwd) {
			return action.Cwd, nil
		}
		if wsDir != "" {
			return filepath.Join(wsDir, action.Cwd), nil
		}
		return action.Cwd, nil
	}

	if wsDir != "" {
		return wsDir, nil
	}

	home, _ := os.UserHomeDir()
	return home, nil
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
