import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import type { CreateConnectionInput } from '../../../lib/tauri-ipc';

interface ConnectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateConnectionInput) => void;
  supportedDrivers?: string[];
}

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-2)',
  marginTop: 'var(--space-2)',
};

const defaultDrivers = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'clickhouse', label: 'ClickHouse' },
];

export function ConnectionForm({ open, onOpenChange, onSubmit, supportedDrivers }: ConnectionFormProps) {
  const [name, setName] = React.useState('');
  const [driver, setDriver] = React.useState('postgres');
  const [dsn, setDsn] = React.useState('');

  const driverOptions = supportedDrivers
    ? defaultDrivers.filter((d) => supportedDrivers.includes(d.value))
    : defaultDrivers;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dsn.trim()) return;
    onSubmit({ name: name.trim(), driver, dsn: dsn.trim() });
    setName('');
    setDriver('postgres');
    setDsn('');
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New Connection"
      description="Add a database connection to this workspace."
    >
      <form style={formStyle} onSubmit={handleSubmit}>
        <Input
          label="Name"
          placeholder="My Database"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Select
          label="Driver"
          value={driver}
          onValueChange={setDriver}
          options={driverOptions}
        />
        <Input
          label="DSN"
          placeholder="postgres://user:pass@localhost:5432/db"
          value={dsn}
          onChange={(e) => setDsn(e.target.value)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
        />
        <div style={actionsStyle}>
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!name.trim() || !dsn.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
