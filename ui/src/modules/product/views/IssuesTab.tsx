import React from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useProductStore } from '../stores/product-store';
import type { ProductIssue } from '../stores/product-store';
import { toast } from 'sonner';

type IssueStatus = 'open' | 'in-progress' | 'closed';
type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type IssueType = 'bug' | 'feature' | 'debt' | 'security' | 'perf' | 'ux' | 'docs' | 'other';

const STATUSES: IssueStatus[] = ['open', 'in-progress', 'closed'];
const SEVERITIES: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
const TYPES: IssueType[] = ['bug', 'feature', 'debt', 'security', 'perf', 'ux', 'docs', 'other'];

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#9b2c2c',
  high: '#c05621',
  medium: '#b7791f',
  low: '#2b6cb0',
  info: 'var(--text-disabled)',
};

interface Props {
  workspaceId: string;
}

export function IssuesTab({ workspaceId }: Props) {
  const issues = useProductStore((s) => s.issues);
  const loadIssues = useProductStore((s) => s.loadIssues);
  const createIssue = useProductStore((s) => s.createIssue);
  const updateIssue = useProductStore((s) => s.updateIssue);
  const deleteIssue = useProductStore((s) => s.deleteIssue);

  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [filterSeverity, setFilterSeverity] = React.useState<string>('all');
  const [filterType, setFilterType] = React.useState<string>('all');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editingIssue, setEditingIssue] = React.useState<ProductIssue | null>(null);
  const [newIssueOpen, setNewIssueOpen] = React.useState(false);

  React.useEffect(() => {
    loadIssues(workspaceId).catch(() => {});
  }, [workspaceId, loadIssues]);

  const filtered = issues.filter((iss) => {
    if (filterStatus !== 'all' && iss.status !== filterStatus) return false;
    if (filterSeverity !== 'all' && iss.severity !== filterSeverity) return false;
    if (filterType !== 'all' && iss.type !== filterType) return false;
    return true;
  });

  const handleCreate = async (req: Partial<ProductIssue>) => {
    try {
      await createIssue(workspaceId, req);
      setNewIssueOpen(false);
    } catch {
      toast.error('Failed to create issue');
    }
  };

  const handleUpdate = async (id: string, patch: Partial<ProductIssue>) => {
    try {
      await updateIssue(workspaceId, id, patch);
      setEditingIssue(null);
    } catch {
      toast.error('Failed to update issue');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete ${id}?`)) return;
    try {
      await deleteIssue(workspaceId, id);
      if (expandedId === id) setExpandedId(null);
    } catch {
      toast.error('Failed to delete issue');
    }
  };

  const openCount = issues.filter((i) => i.status === 'open' || i.status === 'in-progress').length;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={titleStyle}>Issues</span>
          <span style={countBadgeStyle}>{openCount} open · {issues.length} total</span>
        </div>
        <button onClick={() => setNewIssueOpen(true)} style={newIssueBtnStyle}>
          <Plus size={12} /> New issue
        </button>
      </div>

      {/* Filters */}
      <div style={filterBarStyle}>
        <FilterSelect label="Status" value={filterStatus} options={['all', ...STATUSES]} onChange={setFilterStatus} />
        <FilterSelect label="Severity" value={filterSeverity} options={['all', ...SEVERITIES]} onChange={setFilterSeverity} />
        <FilterSelect label="Type" value={filterType} options={['all', ...TYPES]} onChange={setFilterType} />
      </div>

      {/* Issues list */}
      <div style={listStyle}>
        {filtered.length === 0 && (
          <div style={emptyStyle}>No issues match the current filters</div>
        )}
        {filtered.map((iss) => (
          <IssueRow
            key={iss.id}
            issue={iss}
            expanded={expandedId === iss.id}
            onToggle={() => setExpandedId(expandedId === iss.id ? null : iss.id)}
            onEdit={() => setEditingIssue(iss)}
            onDelete={() => handleDelete(iss.id)}
          />
        ))}
      </div>

      {/* New issue modal */}
      <IssueModal
        open={newIssueOpen}
        title="New issue"
        onClose={() => setNewIssueOpen(false)}
        onSave={handleCreate}
      />

      {/* Edit issue modal */}
      {editingIssue && (
        <IssueModal
          open={true}
          title={`Edit ${editingIssue.id}`}
          initial={editingIssue}
          onClose={() => setEditingIssue(null)}
          onSave={(patch) => handleUpdate(editingIssue.id, patch)}
        />
      )}
    </div>
  );
}

// ─── Issue row (read-only, collapsible) ───────────────────────────────────

function IssueRow({
  issue,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  issue: ProductIssue;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      style={{ borderBottom: '1px solid var(--rgba(255,255,255,0.08))' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Collapsed row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: '10px var(--space-4)',
          cursor: 'pointer',
          background: hovered && !expanded ? 'var(--bg-hover)' : 'transparent',
          transition: 'background 80ms ease',
        }}
      >
        <span style={{ color: 'var(--text-disabled)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-disabled)', flexShrink: 0, minWidth: 72 }}>
          {issue.id}
        </span>
        <SeverityDot severity={issue.severity} />
        <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {issue.title}
        </span>
        <TypeBadge type={issue.type} />
        <StatusBadge status={issue.status} />
      </div>

      {/* Expanded read-only view */}
      {expanded && (
        <div style={expandedStyle}>
          {/* Meta row */}
          <div style={metaRowStyle}>
            <MetaItem label="Severity">
              <span style={{ fontSize: '12px', color: SEVERITY_COLORS[issue.severity] ?? 'var(--text-disabled)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <SeverityDot severity={issue.severity} />
                {issue.severity || '—'}
              </span>
            </MetaItem>
            <MetaItem label="Type"><TypeBadge type={issue.type} /></MetaItem>
            <MetaItem label="Status"><StatusBadge status={issue.status} /></MetaItem>
            {issue.domain && <MetaItem label="Domain"><span style={metaValueStyle}>{issue.domain}</span></MetaItem>}
            {issue.feature && <MetaItem label="Feature"><span style={metaValueStyle}>{issue.feature}</span></MetaItem>}
          </div>

          {/* Body */}
          {issue.body && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={readLabelStyle}>Description</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{issue.body}</div>
            </div>
          )}

          {/* Fix */}
          {issue.fix && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={readLabelStyle}>Proposed fix</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{issue.fix}</div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
            <button onClick={onEdit} style={editRowBtnStyle}>
              <Pencil size={11} /> Edit
            </button>
            <button onClick={onDelete} style={deleteRowBtnStyle}>
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={readLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

// ─── Issue modal (create + edit) ───────────────────────────────────────────

function IssueModal({
  open,
  title,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial?: ProductIssue;
  onClose: () => void;
  onSave: (req: Partial<ProductIssue>) => Promise<void>;
}) {
  const [form, setForm] = React.useState<Partial<ProductIssue>>({
    title: initial?.title ?? '',
    type: initial?.type ?? 'bug',
    severity: initial?.severity ?? 'medium',
    status: initial?.status ?? 'open',
    domain: initial?.domain ?? '',
    feature: initial?.feature ?? '',
    body: initial?.body ?? '',
    fix: initial?.fix ?? '',
  });
  const [submitting, setSubmitting] = React.useState(false);

  // Reset when initial changes (switching between issues)
  React.useEffect(() => {
    setForm({
      title: initial?.title ?? '',
      type: initial?.type ?? 'bug',
      severity: initial?.severity ?? 'medium',
      status: initial?.status ?? 'open',
      domain: initial?.domain ?? '',
      feature: initial?.feature ?? '',
      body: initial?.body ?? '',
      fix: initial?.fix ?? '',
    });
  }, [initial?.id]);

  const handle = async () => {
    if (!form.title?.trim()) return;
    setSubmitting(true);
    try {
      await onSave(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={modalStyle} onFocusOutside={(e) => e.preventDefault()}>
          <Dialog.Title style={modalTitleStyle}>{title}</Dialog.Title>

          <div style={formGridStyle}>
            <div style={{ gridColumn: '1 / -1' }}>
              <ModalField label="Title">
                <input
                  autoFocus
                  value={form.title ?? ''}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') handle(); }}
                  placeholder="Describe the issue…"
                  style={inputStyle}
                />
              </ModalField>
            </div>

            <ModalField label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={selectStyle}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </ModalField>

            <ModalField label="Severity">
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} style={selectStyle}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </ModalField>

            <ModalField label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={selectStyle}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </ModalField>

            <ModalField label="Domain">
              <input value={form.domain ?? ''} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="e.g. Auth" style={inputStyle} />
            </ModalField>

            <ModalField label="Feature">
              <input value={form.feature ?? ''} onChange={(e) => setForm({ ...form, feature: e.target.value })} placeholder="e.g. Login" style={inputStyle} />
            </ModalField>

            <div style={{ gridColumn: '1 / -1' }}>
              <ModalField label="Description">
                <textarea value={form.body ?? ''} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} placeholder="What's the issue?" style={textareaStyle} />
              </ModalField>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <ModalField label="Proposed fix">
                <textarea value={form.fix ?? ''} onChange={(e) => setForm({ ...form, fix: e.target.value })} rows={2} placeholder="How should it be fixed?" style={textareaStyle} />
              </ModalField>
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button onClick={handle} disabled={!form.title?.trim() || submitting} style={{
              ...primaryBtnStyle,
              opacity: !form.title?.trim() || submitting ? 0.4 : 1,
              cursor: !form.title?.trim() || submitting ? 'default' : 'pointer',
            }}>
              {submitting ? 'Saving…' : initial ? 'Save changes' : 'Create issue'}
            </button>
            <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          </div>

          <Dialog.Close asChild>
            <button style={closeBtnStyle}><X size={14} /></button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <div style={modalFieldLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: string }) {
  const color = SEVERITY_COLORS[severity] ?? 'var(--text-disabled)';
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} title={severity} />;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-disabled)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', padding: '1px 5px', flexShrink: 0 }}>
      {type || 'other'}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { open: '#4a6a4a', 'in-progress': '#5a6a2a', closed: 'var(--text-disabled)' };
  const color = colors[status] ?? 'var(--text-disabled)';
  return (
    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color, border: `1px solid ${color}`, borderRadius: 'var(--radius-sm)', padding: '1px 5px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {status || 'open'}
    </span>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...selectStyle, fontSize: '11px' }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--rgba(255,255,255,0.08))', flexShrink: 0 };
const titleStyle: React.CSSProperties = { fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' };
const countBadgeStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-disabled)' };
const filterBarStyle: React.CSSProperties = { display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-2) var(--space-4)', borderBottom: '1px solid var(--rgba(255,255,255,0.08))', flexShrink: 0 };
const listStyle: React.CSSProperties = { flex: 1, overflowY: 'auto' };
const emptyStyle: React.CSSProperties = { padding: 'var(--space-8)', color: 'var(--text-disabled)', fontSize: '13px', textAlign: 'center' };
const newIssueBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '11px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const expandedStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-4) var(--space-4) 38px', background: 'rgba(255,255,255,0.025)' };
const metaRowStyle: React.CSSProperties = { display: 'flex', gap: 'var(--space-5)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' };
const metaValueStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--text-secondary)' };
const readLabelStyle: React.CSSProperties = { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-disabled)', marginBottom: 4, fontWeight: 500 };
const editRowBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', fontSize: '11px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const deleteRowBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-disabled)', fontSize: '11px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-sans)' };

// Modal styles
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100 };
const modalStyle: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#050505', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)', width: 560, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', zIndex: 101 };
const modalTitleStyle: React.CSSProperties = { fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' };
const formGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 var(--space-4)' };
const modalFooterStyle: React.CSSProperties = { display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' };
const modalFieldLabelStyle: React.CSSProperties = { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-disabled)', marginBottom: 5, fontWeight: 500 };
const primaryBtnStyle: React.CSSProperties = { background: 'var(--bg-active)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px', padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const cancelBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '12px', padding: '7px 12px', fontFamily: 'var(--font-sans)' };
const closeBtnStyle: React.CSSProperties = { position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 };
const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', padding: '7px 10px', fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px', padding: '7px 8px', fontFamily: 'var(--font-sans)', outline: 'none', width: '100%' };
const textareaStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', padding: '7px 10px', fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', lineHeight: 1.5 };
