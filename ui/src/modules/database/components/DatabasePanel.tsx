import React from 'react';
import { Plus, Terminal, ChevronDown, Trash2 } from 'lucide-react';
import { PanelSection } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { ConnectionForm } from './ConnectionForm';
import { TableBrowser } from './TableBrowser';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useConnectionStore } from '../stores/connection-store';
import { useSettingsStore } from '../../../stores/settings-store';
import { databaseApi, type Table } from '../../../lib/tauri-ipc';
import { toast } from 'sonner';

const driverLabels: Record<string, string> = {
  postgres: 'PG',
  mysql: 'MY',
  sqlite: 'SQ',
};

export function DatabasePanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const config = useSettingsStore((s) => s.config);
  const connections = useConnectionStore((s) => s.connections);
  const activeConnection = useConnectionStore((s) => s.activeConnection);
  const fetchConnections = useConnectionStore((s) => s.fetchConnections);
  const createConnection = useConnectionStore((s) => s.createConnection);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const selectConnection = useConnectionStore((s) => s.selectConnection);
  const addTab = useTabStore((s) => s.addTab);

  const [showForm, setShowForm] = React.useState(false);
  const [tables, setTables] = React.useState<Table[]>([]);
  const [tablesLoading, setTablesLoading] = React.useState(false);
  const [selectorOpen, setSelectorOpen] = React.useState(false);
  const selectorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (activeWorkspace) {
      fetchConnections(activeWorkspace.id).catch(() => {});
    }
  }, [activeWorkspace, fetchConnections]);

  React.useEffect(() => {
    if (activeWorkspace && activeConnection) {
      setTablesLoading(true);
      databaseApi
        .listTables(activeWorkspace.id, activeConnection.id)
        .then(setTables)
        .catch(() => setTables([]))
        .finally(() => setTablesLoading(false));
    } else {
      setTables([]);
    }
  }, [activeWorkspace, activeConnection]);

  React.useEffect(() => {
    if (!selectorOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [selectorOpen]);

  const handleSelectTable = (table: Table) => {
    if (!activeConnection) return;
    addTab({
      id: `table-${activeConnection.id}-${table.name}`,
      title: table.name,
      type: 'table-browser',
      moduleId: 'database',
      data: { tableName: table.name, connectionId: activeConnection.id },
    });
  };

  const handleOpenQueryRunner = () => {
    if (!activeConnection) return;
    const id = `query-${activeConnection.id}-${Date.now()}`;
    addTab({
      id,
      title: `Query · ${activeConnection.name}`,
      type: 'query-runner',
      moduleId: 'database',
      data: { connectionId: activeConnection.id },
    });
  };

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  return (
    <>
      {/* Connection selector */}
      <div style={{ padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
          <div ref={selectorRef} style={{ flex: 1, position: 'relative' }}>
            <button
              onClick={() => setSelectorOpen(!selectorOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '6px 8px',
                background: 'var(--bg-elevated)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: activeConnection ? 'var(--text-primary)' : 'var(--text-disabled)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeConnection ? (
                  <>
                    <span style={{ color: 'var(--text-disabled)', marginRight: '6px' }}>
                      {driverLabels[activeConnection.driver] || activeConnection.driver}
                    </span>
                    {activeConnection.name}
                  </>
                ) : connections.length === 0 ? (
                  'No connections'
                ) : (
                  'Select connection'
                )}
              </span>
              <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.3 }} />
            </button>

            {selectorOpen && connections.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '2px',
                  background: '#0a0a0a',
                  borderRadius: 'var(--radius-sm)',
                  zIndex: 100,
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                {connections.map((conn) => (
                  <ConnectionOption
                    key={conn.id}
                    name={conn.name}
                    driver={conn.driver}
                    isActive={activeConnection?.id === conn.id}
                    onSelect={() => {
                      selectConnection(conn);
                      setSelectorOpen(false);
                    }}
                    onDelete={() => {
                      deleteConnection(activeWorkspace.id, conn.id).catch((err) =>
                        toast.error(`Failed to delete: ${err}`)
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} title="Add Connection">
            <Plus size={12} />
          </Button>
        </div>
      </div>

      {/* Actions (only when connection selected) */}
      {activeConnection && (
        <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
          <Button size="sm" variant="secondary" onClick={handleOpenQueryRunner} style={{ width: '100%', justifyContent: 'center', gap: '6px' }}>
            <Terminal size={12} />
            New Query
          </Button>
        </div>
      )}

      {/* Tables (only when connection selected) */}
      {activeConnection && (
        <PanelSection title="Tables">
          <TableBrowser
            tables={tables}
            loading={tablesLoading}
            onSelectTable={handleSelectTable}
          />
        </PanelSection>
      )}

      <ConnectionForm
        open={showForm}
        onOpenChange={setShowForm}
        supportedDrivers={config?.supported_databases}
        onSubmit={(data) => {
          createConnection(activeWorkspace.id, data)
            .then(() => toast.success('Connection created'))
            .catch((err) => toast.error(`Failed: ${err}`));
        }}
      />
    </>
  );
}

function ConnectionOption({
  name,
  driver,
  isActive,
  onSelect,
  onDelete,
}: {
  name: string;
  driver: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '6px 8px',
        cursor: 'pointer',
        background: isActive ? 'var(--accent-muted)' : hovered ? 'var(--bg-hover)' : 'transparent',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span style={{ color: 'var(--text-disabled)', fontSize: '10px', fontWeight: 700, width: '20px' }}>
        {driverLabels[driver] || driver}
      </span>
      <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          color: 'var(--text-disabled)',
          opacity: hovered ? 1 : 0,
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
        }}
        title="Delete connection"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
