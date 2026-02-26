import React from 'react';
import { DataTable } from '../../../components/data-table/DataTable';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useConnectionStore } from '../stores/connection-store';
import { databaseApi, type QueryResult } from '../../../lib/tauri-ipc';

interface ConnectionViewProps {
  tableName?: string;
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
};

const errorStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  color: 'var(--status-error)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
};

export function ConnectionView({ tableName }: ConnectionViewProps) {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const activeConnection = useConnectionStore((s) => s.activeConnection);
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    if (!activeWorkspace || !activeConnection || !tableName) return;
    setLoading(true);
    setError(null);
    databaseApi
      .getRows(activeWorkspace.id, activeConnection.id, tableName, page, 50)
      .then((r) => {
        setResult(r);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [activeWorkspace, activeConnection, tableName, page]);

  if (!activeConnection) {
    return <div style={emptyStyle}>Select a connection</div>;
  }

  if (!tableName) {
    return <div style={emptyStyle}>Select a table to browse</div>;
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
    </div>
  );
}
