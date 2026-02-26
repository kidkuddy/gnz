import React from 'react';
import { DataTable } from '../../../components/data-table/DataTable';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useConnectionStore } from '../stores/connection-store';
import { databaseApi, type QueryResult } from '../../../lib/tauri-ipc';

interface ConnectionViewProps {
  tableName?: string;
  connectionId?: string;
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-4)',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  flexShrink: 0,
};

const tableNameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-disabled)',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  background: 'var(--bg-base)',
};

const errorStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  color: 'var(--status-error)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  background: 'var(--bg-base)',
};

export function ConnectionView({ tableName, connectionId }: ConnectionViewProps) {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const activeConnection = useConnectionStore((s) => s.activeConnection);
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);

  // Use the connectionId from tab data, fall back to active connection
  const connId = connectionId || activeConnection?.id;

  React.useEffect(() => {
    if (!activeWorkspace || !connId || !tableName) return;
    setLoading(true);
    setError(null);
    setResult(null);
    databaseApi
      .getRows(activeWorkspace.id, connId, tableName, page, 50)
      .then((r) => {
        setResult(r);
      })
      .catch((err) => {
        setError(String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeWorkspace, connId, tableName, page]);

  if (!connId) {
    return <div style={emptyStyle}>Select a connection</div>;
  }

  if (!tableName) {
    return <div style={emptyStyle}>Select a table to browse</div>;
  }

  if (loading && !result) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={tableNameStyle}>{tableName}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Loading...</span>
        </div>
        <div style={emptyStyle}>Loading rows...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={tableNameStyle}>{tableName}</span>
        {loading && (
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Loading...</span>
        )}
      </div>
      {error && <div style={errorStyle}>{error}</div>}
      {result && !error && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <DataTable
            result={result}
            page={page}
            onPageChange={setPage}
            totalPages={Math.ceil(result.row_count / 50)}
          />
        </div>
      )}
      {!result && !error && !loading && (
        <div style={emptyStyle}>No data</div>
      )}
    </div>
  );
}
