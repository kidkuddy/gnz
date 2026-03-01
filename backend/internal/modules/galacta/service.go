package galacta

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const DefaultPort = 9090

type Status struct {
	Running bool   `json:"running"`
	Port    int    `json:"port"`
	Version string `json:"version,omitempty"`
}

type HealthResponse struct {
	Version        string `json:"version"`
	ActiveSessions int    `json:"active_sessions"`
	TotalTools     int    `json:"total_tools"`
}

type Service struct {
	mu      sync.Mutex
	port    int
	proc    *exec.Cmd
	cancel  context.CancelFunc
	running bool
}

func NewService() *Service {
	return &Service{port: DefaultPort}
}

// Check probes Galacta's /health endpoint and returns current status.
func (s *Service) Check() Status {
	resp, err := httpGet(fmt.Sprintf("http://127.0.0.1:%d/health", s.port), 2*time.Second)
	if err != nil {
		slog.Debug("galacta health check failed", "error", err)
		return Status{Running: false, Port: s.port}
	}
	defer resp.Body.Close()

	var h HealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&h); err != nil {
		return Status{Running: true, Port: s.port}
	}
	return Status{Running: true, Port: s.port, Version: h.Version}
}

// Launch finds the galacta binary and spawns it in the background.
// Returns immediately; the process is monitored in a goroutine.
func (s *Service) Launch() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return nil
	}

	bin, err := resolveBinary()
	if err != nil {
		slog.Error("galacta binary not found", "error", err)
		return fmt.Errorf("galacta binary not found: %w", err)
	}
	slog.Info("galacta launching", "binary", bin)

	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, bin, "serve")
	cmd.Env = os.Environ()

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return err
	}
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("starting galacta: %w", err)
	}

	s.proc = cmd
	s.cancel = cancel
	s.running = true

	// Wait for "listening" line on stdout, then hand off to background goroutine.
	ready := make(chan struct{})
	go func() {
		scanner := bufio.NewScanner(stdout)
		readyOnce := sync.Once{}
		for scanner.Scan() {
			line := scanner.Text()
			if strings.Contains(line, "listening") || strings.Contains(line, "READY") {
				readyOnce.Do(func() { close(ready) })
			}
		}
		readyOnce.Do(func() { close(ready) }) // closed if process exits before printing
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	go func() {
		cmd.Wait()
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	// Wait up to 10 seconds for the process to be ready.
	select {
	case <-ready:
	case <-time.After(10 * time.Second):
	}

	return nil
}

// Shutdown kills the managed Galacta process if we spawned it.
func (s *Service) Shutdown() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
	}
}

func resolveBinary() (string, error) {
	home, _ := os.UserHomeDir()
	candidates := []string{
		filepath.Join(home, ".local", "bin", "galacta"),
		filepath.Join(home, "go", "bin", "galacta"),
		"/usr/local/bin/galacta",
		"/opt/homebrew/bin/galacta",
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	if p, err := exec.LookPath("galacta"); err == nil {
		return p, nil
	}
	return "", fmt.Errorf("not found in common paths or PATH")
}

func httpGet(url string, timeout time.Duration) (*http.Response, error) {
	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	return client.Do(req)
}

// ProxySSE forwards an SSE stream from Galacta to the ResponseWriter.
// It reads the upstream response body line-by-line and writes it verbatim.
func ProxySSE(w http.ResponseWriter, upstream io.Reader) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	scanner := bufio.NewScanner(upstream)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		fmt.Fprintf(w, "%s\n", line)
		flusher.Flush()
	}
}
