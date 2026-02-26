package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type QueryResult struct {
	Columns    []string        `json:"columns"`
	Rows       [][]interface{} `json:"rows"`
	RowCount   int             `json:"row_count"`
	DurationMs float64         `json:"duration_ms"`
}

func Execute(db *sql.DB, query string, args ...interface{}) (*QueryResult, error) {
	start := time.Now()

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("executing query: %w", err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("getting columns: %w", err)
	}

	var resultRows [][]interface{}
	for rows.Next() {
		values := make([]interface{}, len(cols))
		scanArgs := make([]interface{}, len(cols))
		for i := range values {
			scanArgs[i] = &values[i]
		}

		if err := rows.Scan(scanArgs...); err != nil {
			return nil, fmt.Errorf("scanning row: %w", err)
		}

		// Convert []byte to string for JSON serialization
		row := make([]interface{}, len(cols))
		for i, v := range values {
			if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
			}
		}
		resultRows = append(resultRows, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating rows: %w", err)
	}

	return &QueryResult{
		Columns:    cols,
		Rows:       resultRows,
		RowCount:   len(resultRows),
		DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

func FormatMarkdown(result *QueryResult) string {
	if len(result.Columns) == 0 {
		return "_No results_"
	}

	var sb strings.Builder

	// Header
	sb.WriteString("| ")
	sb.WriteString(strings.Join(result.Columns, " | "))
	sb.WriteString(" |\n")

	// Separator
	sb.WriteString("| ")
	for i := range result.Columns {
		if i > 0 {
			sb.WriteString(" | ")
		}
		sb.WriteString("---")
	}
	sb.WriteString(" |\n")

	// Rows
	for _, row := range result.Rows {
		sb.WriteString("| ")
		for i, v := range row {
			if i > 0 {
				sb.WriteString(" | ")
			}
			sb.WriteString(fmt.Sprintf("%v", v))
		}
		sb.WriteString(" |\n")
	}

	sb.WriteString(fmt.Sprintf("\n_%d rows_", result.RowCount))
	return sb.String()
}

func FormatJSON(result *QueryResult) string {
	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return string(data)
}
