package database

import (
	"database/sql"
	"fmt"
)

type TableInfo struct {
	Name   string       `json:"name"`
	Schema string       `json:"schema,omitempty"`
}

type ColumnInfo struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Nullable   bool   `json:"nullable"`
	PrimaryKey bool   `json:"primary_key"`
}

func ListTables(db *sql.DB, driver string) ([]TableInfo, error) {
	var query string
	switch driver {
	case "postgres", "postgresql":
		query = `SELECT table_name, table_schema FROM information_schema.tables
				 WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
				 ORDER BY table_schema, table_name`
	case "mysql":
		query = `SELECT table_name, table_schema FROM information_schema.tables
				 WHERE table_schema = DATABASE()
				 ORDER BY table_name`
	case "sqlite", "sqlite3":
		query = `SELECT name, '' as schema FROM sqlite_master
				 WHERE type='table' AND name NOT LIKE 'sqlite_%'
				 ORDER BY name`
	default:
		return nil, fmt.Errorf("unsupported driver: %s", driver)
	}

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("listing tables: %w", err)
	}
	defer rows.Close()

	var tables []TableInfo
	for rows.Next() {
		var t TableInfo
		if err := rows.Scan(&t.Name, &t.Schema); err != nil {
			return nil, fmt.Errorf("scanning table info: %w", err)
		}
		tables = append(tables, t)
	}
	return tables, rows.Err()
}

func DescribeTable(db *sql.DB, driver, table string) ([]ColumnInfo, error) {
	var query string
	switch driver {
	case "postgres", "postgresql":
		query = fmt.Sprintf(`SELECT c.column_name, c.data_type,
				CASE WHEN c.is_nullable = 'YES' THEN 1 ELSE 0 END as nullable,
				CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN 1 ELSE 0 END as pk
			FROM information_schema.columns c
			LEFT JOIN information_schema.key_column_usage kcu
				ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
			LEFT JOIN information_schema.table_constraints tc
				ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
			WHERE c.table_name = '%s'
			ORDER BY c.ordinal_position`, table)
	case "mysql":
		query = fmt.Sprintf(`SELECT column_name, column_type,
				CASE WHEN is_nullable = 'YES' THEN 1 ELSE 0 END as nullable,
				CASE WHEN column_key = 'PRI' THEN 1 ELSE 0 END as pk
			FROM information_schema.columns
			WHERE table_schema = DATABASE() AND table_name = '%s'
			ORDER BY ordinal_position`, table)
	case "sqlite", "sqlite3":
		query = fmt.Sprintf(`PRAGMA table_info('%s')`, table)
		return describeSQLiteTable(db, query)
	default:
		return nil, fmt.Errorf("unsupported driver: %s", driver)
	}

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("describing table: %w", err)
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var c ColumnInfo
		var nullable, pk int
		if err := rows.Scan(&c.Name, &c.Type, &nullable, &pk); err != nil {
			return nil, fmt.Errorf("scanning column info: %w", err)
		}
		c.Nullable = nullable == 1
		c.PrimaryKey = pk == 1
		columns = append(columns, c)
	}
	return columns, rows.Err()
}

func describeSQLiteTable(db *sql.DB, query string) ([]ColumnInfo, error) {
	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("describing sqlite table: %w", err)
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull, pk int
		var dfltValue sql.NullString
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
			return nil, fmt.Errorf("scanning sqlite column info: %w", err)
		}
		columns = append(columns, ColumnInfo{
			Name:       name,
			Type:       colType,
			Nullable:   notNull == 0,
			PrimaryKey: pk == 1,
		})
	}
	return columns, rows.Err()
}
