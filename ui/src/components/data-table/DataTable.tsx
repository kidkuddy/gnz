import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import type { QueryResult } from '../../lib/tauri-ipc';

interface DataTableProps {
  result: QueryResult;
  page?: number;
  onPageChange?: (page: number) => void;
  totalPages?: number;
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  background: 'var(--bg-base)',
};

const tableWrapperStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  position: 'relative',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  background: 'var(--bg-elevated)',
  borderBottom: '1px solid var(--border-default)',
};

const headerCellStyle: React.CSSProperties = {
  padding: '6px var(--space-3)',
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  minWidth: '120px',
  maxWidth: '300px',
  flex: '1 0 120px',
  borderRight: '1px solid var(--border-subtle)',
  userSelect: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowStyle = (index: number): React.CSSProperties => ({
  display: 'flex',
  borderBottom: '1px solid var(--border-subtle)',
  background: index % 2 === 0 ? 'transparent' : 'var(--bg-surface)',
});

const cellStyle: React.CSSProperties = {
  padding: '4px var(--space-3)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  minWidth: '120px',
  maxWidth: '300px',
  flex: '1 0 120px',
  borderRight: '1px solid var(--border-subtle)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: '24px',
};

const nullStyle: React.CSSProperties = {
  color: 'var(--text-disabled)',
  fontStyle: 'italic',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) var(--space-3)',
  borderTop: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
  flexShrink: 0,
};

const paginationStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

function formatCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span style={nullStyle}>NULL</span>;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function DataTable({ result, page = 1, onPageChange, totalPages }: DataTableProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: result.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 20,
  });

  return (
    <div style={containerStyle}>
      <div ref={parentRef} style={tableWrapperStyle}>
        {/* Header */}
        <div style={headerRowStyle}>
          {result.columns.map((col) => (
            <div key={col} style={headerCellStyle} title={col}>
              {col}
            </div>
          ))}
        </div>

        {/* Virtualized rows */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = result.rows[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                style={{
                  ...rowStyle(virtualRow.index),
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.map((cell, cellIdx) => (
                  <div key={cellIdx} style={cellStyle} title={cell != null ? String(cell) : undefined}>
                    {formatCellValue(cell)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <span>
          {result.row_count} row{result.row_count !== 1 ? 's' : ''}
          {result.duration_ms != null && (
            <> &middot; {result.duration_ms.toFixed(1)}ms</>
          )}
        </span>
        {onPageChange && totalPages && totalPages > 1 && (
          <div style={paginationStyle}>
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft size={12} />
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight size={12} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
