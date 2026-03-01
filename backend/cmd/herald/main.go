package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/clusterlab-ai/gnz/backend/pkg/herald"
)

func main() {
	cfg := herald.LoadConfig()

	flag.IntVar(&cfg.Port, "port", cfg.Port, "HTTP port (env: HERALD_PORT)")
	flag.StringVar(&cfg.DataDir, "data-dir", cfg.DataDir, "Data directory (env: HERALD_DATA_DIR)")
	flag.StringVar(&cfg.MCPConfigPath, "mcp-config", cfg.MCPConfigPath, "MCP servers config JSON (env: HERALD_MCP_CONFIG)")
	flag.Parse()

	if cfg.APIKey == "" {
		fmt.Fprintln(os.Stderr, "error: no API key found (set ANTHROPIC_API_KEY or log in with Claude Code)")
		os.Exit(1)
	}

	h, err := herald.New(cfg)
	if err != nil {
		log.Fatalf("failed to initialize herald: %v", err)
	}

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("herald: shutting down...")
		h.Shutdown()
		os.Exit(0)
	}()

	if err := h.Start(); err != nil {
		log.Fatalf("herald: server error: %v", err)
	}
}
