package mcpserver

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/clusterlab-ai/gnz/backend/internal/modules/actions"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/database"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/galacta"
	"github.com/clusterlab-ai/gnz/backend/internal/modules/kanban"
	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

type MCPServer struct {
	srv       *server.MCPServer
	sseServer *server.SSEServer
}

func New(wsSvc *workspace.Service, pool *database.PoolManager, connStore *database.ConnectionStore, actionsStore *actions.Store, actionsMgr *actions.Manager, kanbanStore *kanban.Store, galactaSvc *galacta.Service, galactaStore *galacta.Store) (*MCPServer, error) {
	srv := server.NewMCPServer(
		"gnz-devtools",
		"1.0.0",
		server.WithToolCapabilities(true),
	)

	// Register workspace listing tool
	listWorkspacesTool := mcp.NewTool("devtools_list_workspaces",
		mcp.WithDescription("List all workspaces"),
	)
	srv.AddTool(listWorkspacesTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		workspaces, err := wsSvc.List()
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		data, _ := json.MarshalIndent(workspaces, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	// Register database module MCP tools
	database.RegisterMCPTools(srv, pool, connStore, wsSvc)

	// Register actions module MCP tools
	actions.RegisterMCPTools(srv, actionsStore, actionsMgr)

	// Register kanban module MCP tools
	kanban.RegisterMCPTools(srv, kanbanStore, galactaSvc, galactaStore, wsSvc)

	sseServer := server.NewSSEServer(srv,
		server.WithBasePath("/mcp"),
	)

	return &MCPServer{
		srv:       srv,
		sseServer: sseServer,
	}, nil
}

func (m *MCPServer) Handler() http.Handler {
	return m.sseServer
}
