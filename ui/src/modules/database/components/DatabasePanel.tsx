import React from 'react';
import { Plus, Terminal } from 'lucide-react';
import { PanelSection } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { ConnectionCard } from './ConnectionCard';
import { ConnectionForm } from './ConnectionForm';
import { TableBrowser } from './TableBrowser';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useConnectionStore } from '../stores/connection-store';
import { useSettingsStore } from '../../../stores/settings-store';
import { databaseApi, type Table } from '../../../lib/tauri-ipc';
import { toast } from 'sonner';

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

  const handleSelectTable = (table: Table) => {
    addTab({
      id: `table-${activeConnection?.id}-${table.name}`,
      title: table.name,
      type: 'table-browser',
      moduleId: 'database',
      data: { tableName: table.name, connectionId: activeConnection?.id },
    });
  };

  const handleOpenQueryRunner = () => {
    const id = `query-${Date.now()}`;
    addTab({
      id,
      title: 'Query',
      type: 'query-runner',
      moduleId: 'database',
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
      <PanelSection
        title="Connections"
        action={
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <Button size="sm" variant="secondary" onClick={handleOpenQueryRunner} title="New Query">
              <Terminal size={12} />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} title="Add Connection">
              <Plus size={12} />
            </Button>
          </div>
        }
      >
        {connections.length === 0 ? (
          <div style={{ padding: 'var(--space-4) var(--space-3)', fontSize: '12px', color: 'var(--text-disabled)', textAlign: 'center' }}>
            No connections yet
          </div>
        ) : (
          connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              isActive={activeConnection?.id === conn.id}
              onSelect={() => selectConnection(conn)}
              onDelete={() => {
                deleteConnection(activeWorkspace.id, conn.id).catch((err) =>
                  toast.error(`Failed to delete: ${err}`)
                );
              }}
            />
          ))
        )}
      </PanelSection>

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
