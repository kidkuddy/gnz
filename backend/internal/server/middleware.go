package server

import (
	"log"
	"net/http"
	"time"

	"github.com/clusterlab-ai/gnz/backend/internal/config"
)

func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(wrapped, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, wrapped.status, time.Since(start))
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

// Flush delegates to the underlying ResponseWriter if it supports flushing (required for SSE).
func (sw *statusWriter) Flush() {
	if f, ok := sw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func JSONContentTypeMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}

func FeatureFlagMiddleware(feature string, flags *config.FeatureFlags) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			enabled := false
			switch feature {
			case "db":
				enabled = flags.DB
			case "mcp":
				enabled = flags.MCP
			case "logs":
				enabled = flags.Logs
			case "dashboard":
				enabled = flags.Dashboard
			case "sql_editor":
				enabled = flags.SQLEditor
			}

			if !enabled {
				Error(w, http.StatusForbidden, "feature "+feature+" is not enabled")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
