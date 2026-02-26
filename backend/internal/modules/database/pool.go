package database

import (
	"database/sql"
	"fmt"
	"sync"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

type PoolManager struct {
	mu    sync.RWMutex
	pools map[string]*sql.DB
}

func NewPoolManager() *PoolManager {
	return &PoolManager{
		pools: make(map[string]*sql.DB),
	}
}

func (pm *PoolManager) GetOrCreate(conn Connection) (*sql.DB, error) {
	pm.mu.RLock()
	if db, ok := pm.pools[conn.ID]; ok {
		pm.mu.RUnlock()
		return db, nil
	}
	pm.mu.RUnlock()

	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Double-check after acquiring write lock
	if db, ok := pm.pools[conn.ID]; ok {
		return db, nil
	}

	driverName, err := resolveDriver(conn.Driver)
	if err != nil {
		return nil, err
	}

	db, err := sql.Open(driverName, conn.DSN)
	if err != nil {
		return nil, fmt.Errorf("opening connection %s: %w", conn.ID, err)
	}

	db.SetMaxOpenConns(conn.PoolMaxOpen)
	db.SetMaxIdleConns(conn.PoolMaxIdle)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("pinging connection %s: %w", conn.ID, err)
	}

	pm.pools[conn.ID] = db
	return db, nil
}

func (pm *PoolManager) Close(connID string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if db, ok := pm.pools[connID]; ok {
		db.Close()
		delete(pm.pools, connID)
	}
}

func (pm *PoolManager) CloseAll() {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	for id, db := range pm.pools {
		db.Close()
		delete(pm.pools, id)
	}
}

func resolveDriver(driver string) (string, error) {
	switch driver {
	case "postgres", "postgresql":
		return "pgx", nil
	case "mysql":
		return "mysql", nil
	case "sqlite", "sqlite3":
		return "sqlite", nil
	default:
		return "", fmt.Errorf("unsupported driver: %s", driver)
	}
}
