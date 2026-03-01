package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/appdb"
	"github.com/clusterlab-ai/gnz/backend/internal/config"
	mcpserver "github.com/clusterlab-ai/gnz/backend/internal/mcp"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/actions"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/database"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/files"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/galacta"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/git"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/scratchpad"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/terminal"
	"github.com/clusterlab-ai/gnz/backend/internal/server"
	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

func main() {
	port := flag.Int("port", 0, "HTTP server port (required)")
	flag.Parse()

	if *port == 0 {
		fmt.Fprintln(os.Stderr, "error: --port is required")
		os.Exit(1)
	}

	// Setup structured logging
	logLevel := slog.LevelInfo
	if os.Getenv("GNZ_DEBUG") != "" {
		logLevel = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: logLevel})))

	// Load config
	cfg, err := config.Load(*port)
	if err != nil {
		log.Fatalf("loading config: %v", err)
	}

	// Open app database
	db, err := appdb.Open(cfg.DataDir)
	if err != nil {
		log.Fatalf("opening app database: %v", err)
	}
	defer db.Close()

	// Initialize workspace
	wsStore := workspace.NewStore(db)
	wsSvc := workspace.NewService(wsStore)

	// Initialize database module
	connStore := database.NewConnectionStore(db)
	poolMgr := database.NewPoolManager()
	defer poolMgr.CloseAll()

	// Create HTTP server
	srv := server.New(cfg, wsSvc)

	// Register database module routes under /api/v1
	if cfg.Features.DB {
		srv.RegisterModuleRoutes(func(r chi.Router) {
			database.Register(r, poolMgr, connStore)
		})
	}

	// Initialize and auto-launch Galacta
	var galactaSvc *galacta.Service
	if cfg.Features.Galacta {
		galactaSvc = galacta.NewService()

		// Auto-launch Galacta in background if not already running
		go func() {
			status := galactaSvc.Check()
			if !status.Running {
				if err := galactaSvc.Launch(); err != nil {
					slog.Error("galacta auto-launch failed", "error", err)
				}
			}
		}()

		srv.RegisterModuleRoutes(func(r chi.Router) {
			galacta.Register(r, galactaSvc, db)
		})
	}

	// Register files module routes
	srv.RegisterModuleRoutes(func(r chi.Router) {
		files.Register(r, wsSvc)
	})

	// Register scratchpad module routes
	scratchpadStore := scratchpad.NewStore(db)
	srv.RegisterModuleRoutes(func(r chi.Router) {
		scratchpad.Register(r, scratchpadStore)
	})

	// Initialize terminal module
	termMgr := terminal.NewManager()
	defer termMgr.Shutdown()

	srv.RegisterModuleRoutes(func(r chi.Router) {
		terminal.Register(r, termMgr)
	})

	// Register git module routes
	srv.RegisterModuleRoutes(func(r chi.Router) {
		git.Register(r, wsSvc)
	})

	// Initialize actions module
	actionsStore := actions.NewStore(db)
	actionsMgr := actions.NewManager(actionsStore, wsSvc)
	defer actionsMgr.Shutdown()

	srv.RegisterModuleRoutes(func(r chi.Router) {
		actions.Register(r, actionsStore, actionsMgr)
	})

	// Finalize routes
	srv.Build()

	// Register MCP server
	if cfg.Features.MCP {
		mcpSrv, err := mcpserver.New(wsSvc, poolMgr, connStore, actionsStore, actionsMgr)
		if err != nil {
			log.Fatalf("creating MCP server: %v", err)
		}
		srv.Router.Mount("/mcp", mcpSrv.Handler())
	}

	// Shutdown Galacta on exit (only if we spawned it)
	if galactaSvc != nil {
		defer galactaSvc.Shutdown()
	}

	// Start HTTP server
	addr := fmt.Sprintf(":%d", cfg.Port)
	httpServer := &http.Server{
		Addr:    addr,
		Handler: srv.Router,
	}

	// Graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		fmt.Println("READY")
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("shutdown error: %v", err)
	}

	log.Println("server stopped")
}
