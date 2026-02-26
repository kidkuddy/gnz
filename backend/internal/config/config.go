package config

import (
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

type Config struct {
	Port               int            `json:"port"`
	DataDir            string         `json:"data_dir"`
	SupportedDatabases []string       `json:"supported_databases"`
	SupportedOutputs   []string       `json:"supported_outputs"`
	Features           FeatureFlags   `json:"features"`
}

type FeatureFlags struct {
	DB        bool `json:"db"`
	MCP       bool `json:"mcp"`
	Logs      bool `json:"logs"`
	Dashboard bool `json:"dashboard"`
	SQLEditor bool `json:"sql_editor"`
	Claude    bool `json:"claude"`
}

func Load(port int) (*Config, error) {
	cfg := NewDefault()
	cfg.Port = port

	// Override DataDir from env
	if v := os.Getenv("GNZ_DATA_DIR"); v != "" {
		cfg.DataDir = v
	}

	// Override features from env
	if v := os.Getenv("GNZ_FEATURE_DB"); v != "" {
		cfg.Features.DB = parseBool(v)
	}
	if v := os.Getenv("GNZ_FEATURE_MCP"); v != "" {
		cfg.Features.MCP = parseBool(v)
	}
	if v := os.Getenv("GNZ_FEATURE_LOGS"); v != "" {
		cfg.Features.Logs = parseBool(v)
	}
	if v := os.Getenv("GNZ_FEATURE_DASHBOARD"); v != "" {
		cfg.Features.Dashboard = parseBool(v)
	}
	if v := os.Getenv("GNZ_FEATURE_SQL_EDITOR"); v != "" {
		cfg.Features.SQLEditor = parseBool(v)
	}
	if v := os.Getenv("GNZ_FEATURE_CLAUDE"); v != "" {
		cfg.Features.Claude = parseBool(v)
	}

	// Ensure DataDir exists
	if err := os.MkdirAll(cfg.DataDir, 0o755); err != nil {
		return nil, err
	}

	return cfg, nil
}

func defaultDataDir() string {
	switch runtime.GOOS {
	case "darwin":
		home, _ := os.UserHomeDir()
		return filepath.Join(home, "Library", "Application Support", "com.gnz.app")
	case "linux":
		if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
			return filepath.Join(xdg, "com.gnz.app")
		}
		home, _ := os.UserHomeDir()
		return filepath.Join(home, ".local", "share", "com.gnz.app")
	case "windows":
		appData := os.Getenv("APPDATA")
		return filepath.Join(appData, "com.gnz.app")
	default:
		home, _ := os.UserHomeDir()
		return filepath.Join(home, ".gnz")
	}
}

func parseBool(s string) bool {
	s = strings.TrimSpace(strings.ToLower(s))
	b, err := strconv.ParseBool(s)
	if err != nil {
		return false
	}
	return b
}
