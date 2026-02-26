package database

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/server"
)

type Handler struct {
	pool  *PoolManager
	store *ConnectionStore
}

func NewHandler(pool *PoolManager, store *ConnectionStore) *Handler {
	return &Handler{pool: pool, store: store}
}

func (h *Handler) CreateConnection(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	var body struct {
		Name        string `json:"name"`
		Driver      string `json:"driver"`
		DSN         string `json:"dsn"`
		PoolMaxOpen int    `json:"pool_max_open"`
		PoolMaxIdle int    `json:"pool_max_idle"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	if body.Name == "" || body.Driver == "" || body.DSN == "" {
		server.BadRequest(w, "name, driver, and dsn are required")
		return
	}

	conn := &Connection{
		WorkspaceID: wsID,
		Name:        body.Name,
		Driver:      body.Driver,
		DSN:         body.DSN,
		PoolMaxOpen: body.PoolMaxOpen,
		PoolMaxIdle: body.PoolMaxIdle,
	}

	if err := h.store.Create(conn); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Created(w, conn)
}

func (h *Handler) ListConnections(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	conns, err := h.store.ListByWorkspace(wsID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if conns == nil {
		conns = []Connection{}
	}
	server.Success(w, conns)
}

func (h *Handler) DeleteConnection(w http.ResponseWriter, r *http.Request) {
	connID := chi.URLParam(r, "id")

	h.pool.Close(connID)

	if err := h.store.Delete(connID); err != nil {
		server.BadRequest(w, err.Error())
		return
	}
	server.Success(w, map[string]string{"deleted": connID})
}

func (h *Handler) TestConnection(w http.ResponseWriter, r *http.Request) {
	connID := chi.URLParam(r, "id")

	conn, err := h.store.GetByID(connID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if conn == nil {
		server.NotFound(w, "connection not found")
		return
	}

	db, err := h.pool.GetOrCreate(*conn)
	if err != nil {
		server.Error(w, http.StatusServiceUnavailable, "connection failed: "+err.Error())
		return
	}

	if err := db.Ping(); err != nil {
		server.Error(w, http.StatusServiceUnavailable, "ping failed: "+err.Error())
		return
	}

	server.Success(w, map[string]string{"status": "connected"})
}

func (h *Handler) ListTables(w http.ResponseWriter, r *http.Request) {
	connID := chi.URLParam(r, "conn")

	conn, err := h.store.GetByID(connID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if conn == nil {
		server.NotFound(w, "connection not found")
		return
	}

	db, err := h.pool.GetOrCreate(*conn)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	tables, err := ListTables(db, conn.Driver)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if tables == nil {
		tables = []TableInfo{}
	}
	server.Success(w, tables)
}

func (h *Handler) GetTableRows(w http.ResponseWriter, r *http.Request) {
	connID := chi.URLParam(r, "conn")
	tableName := chi.URLParam(r, "name")

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 1000 {
		perPage = 50
	}

	conn, err := h.store.GetByID(connID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if conn == nil {
		server.NotFound(w, "connection not found")
		return
	}

	db, err := h.pool.GetOrCreate(*conn)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	offset := (page - 1) * perPage
	// Use dialect-appropriate quoting
	var query string
	switch conn.Driver {
	case "postgres", "postgresql":
		query = "SELECT * FROM \"" + tableName + "\" LIMIT " + strconv.Itoa(perPage) + " OFFSET " + strconv.Itoa(offset)
	case "mysql":
		query = "SELECT * FROM `" + tableName + "` LIMIT " + strconv.Itoa(perPage) + " OFFSET " + strconv.Itoa(offset)
	default:
		query = "SELECT * FROM \"" + tableName + "\" LIMIT " + strconv.Itoa(perPage) + " OFFSET " + strconv.Itoa(offset)
	}

	result, err := Execute(db, query)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, map[string]interface{}{
		"page":     page,
		"per_page": perPage,
		"result":   result,
	})
}

func (h *Handler) ExecuteQuery(w http.ResponseWriter, r *http.Request) {
	connID := chi.URLParam(r, "conn")

	var body struct {
		SQL string `json:"sql"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.SQL == "" {
		server.BadRequest(w, "sql is required")
		return
	}

	conn, err := h.store.GetByID(connID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if conn == nil {
		server.NotFound(w, "connection not found")
		return
	}

	db, err := h.pool.GetOrCreate(*conn)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	result, err := Execute(db, body.SQL)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, result)
}
