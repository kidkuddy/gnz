import React from 'react';
import { Table2, ChevronRight } from 'lucide-react';
import type { Table } from '../../../lib/tauri-ipc';

interface TableBrowserProps {
  tables: Table[];
  loading: boolean;
  onSelectTable: (table: Table) => void;
}

const emptyStyle: React.CSSProperties = {
  padding: 'var(--space-4) var(--space-3)',
  fontSize: '12px',
  color: 'var(--text-disabled)',
  textAlign: 'center',
};

export function TableBrowser({ tables, loading, onSelectTable }: TableBrowserProps) {
  if (loading) {
    return <div style={emptyStyle}>Loading tables...</div>;
  }

  if (tables.length === 0) {
    return <div style={emptyStyle}>No tables found</div>;
  }

  return (
    <div style={{ padding: 'var(--space-1) 0' }}>
      {tables.map((table) => (
        <TableRow key={table.name} table={table} onClick={() => onSelectTable(table)} />
      ))}
    </div>
  );
}

function TableRow({ table, onClick }: { table: Table; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '4px var(--space-3)',
    cursor: 'pointer',
    background: hovered ? 'var(--bg-hover)' : 'transparent',
    transition: 'background 80ms ease',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const countStyle: React.CSSProperties = {
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-disabled)',
  };

  return (
    <div
      style={rowStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Table2 size={13} color="var(--text-disabled)" />
      <span style={nameStyle}>{table.name}</span>
      {table.row_count != null && <span style={countStyle}>{table.row_count}</span>}
      <ChevronRight size={12} color="var(--text-disabled)" style={{ opacity: hovered ? 1 : 0 }} />
    </div>
  );
}
