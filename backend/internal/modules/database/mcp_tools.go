package database

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func registerMCPTools(srv *server.MCPServer, pool *PoolManager, store *ConnectionStore) {
	// devtools_list_workspaces
	// Note: This tool needs access to workspace store, but we register it here
	// with a placeholder. The actual workspace listing is wired in mcp/server.go.

	// devtools_list_connections
	listConnectionsTool := mcp.NewTool("devtools_list_connections",
		mcp.WithDescription("List all database connections in a workspace"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
	)
	srv.AddTool(listConnectionsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		wsID, _ := req.Params.Arguments["workspace_id"].(string)
		if wsID == "" {
			return mcp.NewToolResultError("workspace_id is required"), nil
		}

		conns, err := store.ListByWorkspace(wsID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		data, _ := json.MarshalIndent(conns, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	// devtools_sql_query
	sqlQueryTool := mcp.NewTool("devtools_sql_query",
		mcp.WithDescription("Execute a SQL query on a database connection"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
		mcp.WithString("connection_id", mcp.Required(), mcp.Description("Connection ID")),
		mcp.WithString("sql", mcp.Required(), mcp.Description("SQL query to execute")),
		mcp.WithString("output_format", mcp.Description("Output format: markdown or json (default: markdown)")),
	)
	srv.AddTool(sqlQueryTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		connID, _ := req.Params.Arguments["connection_id"].(string)
		sqlStr, _ := req.Params.Arguments["sql"].(string)
		outputFormat, _ := req.Params.Arguments["output_format"].(string)

		if connID == "" || sqlStr == "" {
			return mcp.NewToolResultError("connection_id and sql are required"), nil
		}

		conn, err := store.GetByID(connID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		if conn == nil {
			return mcp.NewToolResultError("connection not found"), nil
		}

		db, err := pool.GetOrCreate(*conn)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		result, err := Execute(db, sqlStr)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		var output string
		if outputFormat == "json" {
			output = FormatJSON(result)
		} else {
			output = FormatMarkdown(result)
		}

		return mcp.NewToolResultText(output), nil
	})

	// devtools_list_tables
	listTablesTool := mcp.NewTool("devtools_list_tables",
		mcp.WithDescription("List all tables in a database connection"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
		mcp.WithString("connection_id", mcp.Required(), mcp.Description("Connection ID")),
	)
	srv.AddTool(listTablesTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		connID, _ := req.Params.Arguments["connection_id"].(string)

		if connID == "" {
			return mcp.NewToolResultError("connection_id is required"), nil
		}

		conn, err := store.GetByID(connID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		if conn == nil {
			return mcp.NewToolResultError("connection not found"), nil
		}

		db, err := pool.GetOrCreate(*conn)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		tables, err := ListTables(db, conn.Driver)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		data, _ := json.MarshalIndent(tables, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	// devtools_describe_table
	describeTableTool := mcp.NewTool("devtools_describe_table",
		mcp.WithDescription("Describe the columns of a table"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
		mcp.WithString("connection_id", mcp.Required(), mcp.Description("Connection ID")),
		mcp.WithString("table_name", mcp.Required(), mcp.Description("Table name to describe")),
	)
	srv.AddTool(describeTableTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		connID, _ := req.Params.Arguments["connection_id"].(string)
		tableName, _ := req.Params.Arguments["table_name"].(string)

		if connID == "" || tableName == "" {
			return mcp.NewToolResultError("connection_id and table_name are required"), nil
		}

		conn, err := store.GetByID(connID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		if conn == nil {
			return mcp.NewToolResultError("connection not found"), nil
		}

		db, err := pool.GetOrCreate(*conn)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		columns, err := DescribeTable(db, conn.Driver, tableName)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("describing table: %s", err.Error())), nil
		}

		data, _ := json.MarshalIndent(columns, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})
}
