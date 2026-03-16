import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil, Check, Plus, X } from 'lucide-react';
import { useProductStore } from '../stores/product-store';
import { Checkbox } from '../components/Checkbox';
import type { ProductGoal, ProductTechRow, ProductScope } from '../stores/product-store';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
}

export function SpecTab({ workspaceId }: Props) {
  const product = useProductStore((s) => s.product);
  const saveProduct = useProductStore((s) => s.saveProduct);
  const saving = useProductStore((s) => s.saving);

  const [editMode, setEditMode] = React.useState(false);
  const [draft, setDraft] = React.useState(product);

  React.useEffect(() => {
    setDraft(product);
  }, [product]);

  if (!product || !draft) return null;

  const handleSave = async () => {
    try {
      await saveProduct(workspaceId, draft);
      setEditMode(false);
    } catch {
      toast.error('Failed to save product spec');
    }
  };

  const handleCancel = () => {
    setDraft(product);
    setEditMode(false);
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={headerTitleStyle}>Spec</span>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {editMode ? (
            <>
              <ActionBtn onClick={handleCancel} label="Cancel" />
              <ActionBtn onClick={handleSave} label={saving ? 'Saving…' : 'Save'} primary />
            </>
          ) : (
            <ActionBtn onClick={() => setEditMode(true)} label="Edit" icon={<Pencil size={11} />} />
          )}
        </div>
      </div>

      <div style={bodyStyle}>
        {/* Identity */}
        <Section title="Identity">
          <FieldRow label="Name">
            <EditableText value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} edit={editMode} large />
          </FieldRow>
          <FieldRow label="Description">
            <EditableText value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} edit={editMode} />
          </FieldRow>
          <FieldRow label="Version">
            <EditableText value={draft.version} onChange={(v) => setDraft({ ...draft, version: v })} edit={editMode} mono />
          </FieldRow>
          <FieldRow label="Last updated">
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {draft.last_updated || '—'}
            </span>
          </FieldRow>
        </Section>

        {/* Vision */}
        <Section title="Vision">
          {editMode ? (
            <textarea
              value={draft.vision}
              onChange={(e) => setDraft({ ...draft, vision: e.target.value })}
              rows={5}
              placeholder="Describe your product vision…"
              style={textareaStyle}
            />
          ) : (
            <Prose content={draft.vision} placeholder="No vision defined." />
          )}
        </Section>

        {/* Goals */}
        <Section title="Goals">
          <GoalsList goals={draft.goals} edit={editMode} onChange={(goals) => setDraft({ ...draft, goals })} />
        </Section>

        {/* Tech Stack */}
        <Section title="Tech Stack">
          <TechStackTable rows={draft.tech_stack} edit={editMode} onChange={(tech_stack) => setDraft({ ...draft, tech_stack })} />
        </Section>

        {/* Architecture */}
        <Section title="Architecture">
          {editMode ? (
            <textarea
              value={draft.architecture}
              onChange={(e) => setDraft({ ...draft, architecture: e.target.value })}
              rows={5}
              placeholder="Describe the architecture…"
              style={textareaStyle}
            />
          ) : (
            <Prose content={draft.architecture} placeholder="No architecture notes." />
          )}
        </Section>

        {/* Scopes */}
        <Section title="Scopes">
          <ScopesTable rows={draft.scopes} edit={editMode} onChange={(scopes) => setDraft({ ...draft, scopes })} />
        </Section>

        {/* Open Questions */}
        <Section title="Open Questions">
          <StringList
            items={draft.open_questions}
            edit={editMode}
            onChange={(open_questions) => setDraft({ ...draft, open_questions })}
            placeholder="Add a question…"
          />
        </Section>
      </div>
    </div>
  );
}

// ─── Prose (markdown read-only) ────────────────────────────────────────────

function Prose({ content, placeholder }: { content: string; placeholder?: string }) {
  if (!content?.trim()) {
    return <span style={{ fontSize: '13px', color: 'var(--text-disabled)' }}>{placeholder}</span>;
  }
  return (
    <div style={proseStyle} className="product-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 0 }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, marginTop: 12 }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, marginTop: 10 }}>{children}</h3>,
          p: ({ children }) => <p style={{ margin: '0 0 8px', lineHeight: 1.65, color: 'var(--text-secondary)', fontSize: '13px' }}>{children}</p>,
          ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '0 0 8px', color: 'var(--text-secondary)' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '0 0 8px', color: 'var(--text-secondary)' }}>{children}</ol>,
          li: ({ children }) => <li style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: 2 }}>{children}</li>,
          code: ({ children }) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 2, color: 'var(--text-secondary)' }}>{children}</code>,
          pre: ({ children }) => <pre style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', overflowX: 'auto', margin: '0 0 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{children}</pre>,
          blockquote: ({ children }) => <blockquote style={{ borderLeft: '2px solid var(--border-strong)', margin: '0 0 8px', paddingLeft: 12, color: 'var(--text-tertiary)' }}>{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-2)', minHeight: 24 }}>
      <span style={{ width: 110, flexShrink: 0, fontSize: '11px', color: 'var(--text-disabled)', paddingTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function EditableText({ value, onChange, edit, large, mono }: {
  value: string; onChange: (v: string) => void; edit: boolean; large?: boolean; mono?: boolean;
}) {
  const style: React.CSSProperties = {
    fontSize: large ? '14px' : '12px',
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
    color: 'var(--text-primary)',
    fontWeight: large ? 600 : 400,
  };
  if (!edit) return <span style={style}>{value || '—'}</span>;
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...style, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '3px 6px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
    />
  );
}

function GoalsList({ goals, edit, onChange }: { goals: ProductGoal[]; edit: boolean; onChange: (g: ProductGoal[]) => void }) {
  const [adding, setAdding] = React.useState(false);
  const [newDesc, setNewDesc] = React.useState('');
  const [newSlug, setNewSlug] = React.useState('');

  const add = () => {
    if (!newDesc.trim()) return;
    const slug = newSlug.trim() || newDesc.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20);
    onChange([...goals, { slug, description: newDesc.trim(), done: false }]);
    setNewDesc('');
    setNewSlug('');
    setAdding(false);
  };

  return (
    <div>
      {goals.map((g, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <div style={{ paddingTop: 1, flexShrink: 0 }}>
            <Checkbox checked={g.done} onChange={() => onChange(goals.map((gg, ii) => ii === i ? { ...gg, done: !gg.done } : gg))} />
          </div>
          <div style={{ flex: 1 }}>
            {edit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <input
                  value={g.description}
                  onChange={(e) => onChange(goals.map((gg, ii) => ii === i ? { ...gg, description: e.target.value } : gg))}
                  style={{ ...inlineInputStyle, textDecoration: g.done ? 'line-through' : 'none' }}
                />
                <input
                  value={g.slug}
                  onChange={(e) => onChange(goals.map((gg, ii) => ii === i ? { ...gg, slug: e.target.value } : gg))}
                  placeholder="id (slug)"
                  style={{ ...inlineInputStyle, fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-disabled)' }}
                />
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: g.done ? 'line-through' : 'none', lineHeight: 1.5 }}>
                {g.description}
              </span>
            )}
          </div>
          {edit && (
            <button onClick={() => onChange(goals.filter((_, ii) => ii !== i))} style={ghostBtnStyle}>
              <X size={11} />
            </button>
          )}
        </div>
      ))}

      {edit && (
        adding ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--space-2)' }}>
            <input autoFocus value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Goal description…" style={inlineInputStyle} />
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="id (optional)" style={{ ...inlineInputStyle, fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-disabled)', width: 120 }} />
              <button onClick={add} style={ghostBtnStyle}><Check size={11} /></button>
              <button onClick={() => setAdding(false)} style={ghostBtnStyle}><X size={11} /></button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={addRowBtnStyle}><Plus size={11} /> Add goal</button>
        )
      )}
    </div>
  );
}

function TechStackTable({ rows, edit, onChange }: { rows: ProductTechRow[]; edit: boolean; onChange: (r: ProductTechRow[]) => void }) {
  const [adding, setAdding] = React.useState(false);
  const [newLayer, setNewLayer] = React.useState('');
  const [newTech, setNewTech] = React.useState('');

  const add = () => {
    if (!newLayer.trim() || !newTech.trim()) return;
    onChange([...rows, { layer: newLayer.trim(), technology: newTech.trim() }]);
    setNewLayer('');
    setNewTech('');
    setAdding(false);
  };

  return (
    <div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Layer</th>
            <th style={thStyle}>Technology</th>
            {edit && <th style={{ ...thStyle, width: 24 }} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={tdStyle}>{edit ? <input value={r.layer} onChange={(e) => onChange(rows.map((rr, ii) => ii === i ? { ...rr, layer: e.target.value } : rr))} style={inlineInputStyle} /> : r.layer}</td>
              <td style={tdStyle}>{edit ? <input value={r.technology} onChange={(e) => onChange(rows.map((rr, ii) => ii === i ? { ...rr, technology: e.target.value } : rr))} style={inlineInputStyle} /> : r.technology}</td>
              {edit && <td style={tdStyle}><button onClick={() => onChange(rows.filter((_, ii) => ii !== i))} style={ghostBtnStyle}><X size={11} /></button></td>}
            </tr>
          ))}
          {edit && adding && (
            <tr>
              <td style={tdStyle}><input autoFocus value={newLayer} onChange={(e) => setNewLayer(e.target.value)} placeholder="layer" style={inlineInputStyle} /></td>
              <td style={tdStyle}><input value={newTech} onChange={(e) => setNewTech(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }} placeholder="technology" style={inlineInputStyle} /></td>
              <td style={tdStyle}><button onClick={add} style={ghostBtnStyle}><Check size={11} /></button></td>
            </tr>
          )}
        </tbody>
      </table>
      {edit && !adding && <button onClick={() => setAdding(true)} style={addRowBtnStyle}><Plus size={11} /> Add row</button>}
    </div>
  );
}

function ScopesTable({ rows, edit, onChange }: { rows: ProductScope[]; edit: boolean; onChange: (r: ProductScope[]) => void }) {
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState<ProductScope>({ name: '', path: '', type: '', state: '' });
  const cols: Array<keyof ProductScope & string> = ['name', 'path', 'type', 'state'];

  const add = () => {
    if (!draft.name.trim()) return;
    onChange([...rows, { ...draft }]);
    setDraft({ name: '', path: '', type: '', state: '' });
    setAdding(false);
  };

  return (
    <div>
      <table style={tableStyle}>
        <thead>
          <tr>
            {cols.map((c) => <th key={c} style={thStyle}>{c}</th>)}
            {edit && <th style={{ ...thStyle, width: 24 }} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} style={tdStyle}>
                  {edit ? <input value={r[c]} onChange={(e) => onChange(rows.map((rr, ii) => ii === i ? { ...rr, [c]: e.target.value } : rr))} style={inlineInputStyle} /> : r[c]}
                </td>
              ))}
              {edit && <td style={tdStyle}><button onClick={() => onChange(rows.filter((_, ii) => ii !== i))} style={ghostBtnStyle}><X size={11} /></button></td>}
            </tr>
          ))}
          {edit && adding && (
            <tr>
              {cols.map((c, ci) => (
                <td key={c} style={tdStyle}>
                  <input autoFocus={ci === 0} value={draft[c]} onChange={(e) => setDraft({ ...draft, [c]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }} placeholder={c} style={inlineInputStyle} />
                </td>
              ))}
              <td style={tdStyle}><button onClick={add} style={ghostBtnStyle}><Check size={11} /></button></td>
            </tr>
          )}
        </tbody>
      </table>
      {edit && !adding && <button onClick={() => setAdding(true)} style={addRowBtnStyle}><Plus size={11} /> Add scope</button>}
    </div>
  );
}

function StringList({ items, edit, onChange, placeholder }: { items: string[]; edit: boolean; onChange: (s: string[]) => void; placeholder?: string }) {
  const [input, setInput] = React.useState('');

  const add = () => {
    if (!input.trim()) return;
    onChange([...items, input.trim()]);
    setInput('');
  };

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
          <span style={{ fontSize: '12px', color: 'var(--text-disabled)', flexShrink: 0, minWidth: 18 }}>{i + 1}.</span>
          {edit ? (
            <input value={item} onChange={(e) => onChange(items.map((ii, idx) => idx === i ? e.target.value : ii))} style={{ ...inlineInputStyle, flex: 1 }} />
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>{item}</span>
          )}
          {edit && <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} style={ghostBtnStyle}><X size={11} /></button>}
        </div>
      ))}
      {edit && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 4 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder={placeholder} style={{ ...inlineInputStyle, flex: 1 }} />
          <button onClick={add} style={ghostBtnStyle}><Plus size={11} /></button>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, label, icon, primary }: { onClick: () => void; label: string; icon?: React.ReactNode; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        background: primary ? 'var(--bg-active)' : 'transparent',
        border: `1px solid ${primary ? 'var(--border-strong)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-secondary)',
        fontSize: '11px',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {icon} {label}
    </button>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-4)', borderBottom: '1px solid var(--rgba(255,255,255,0.08))', flexShrink: 0 };
const headerTitleStyle: React.CSSProperties = { fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' };
const bodyStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)', maxWidth: 720, width: '100%', boxSizing: 'border-box' };
const sectionTitleStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-disabled)', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-1)', borderBottom: '1px solid var(--rgba(255,255,255,0.08))' };
const proseStyle: React.CSSProperties = { lineHeight: 1.65 };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '4px 8px 4px 0', color: 'var(--text-disabled)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, borderBottom: '1px solid var(--rgba(255,255,255,0.08))' };
const tdStyle: React.CSSProperties = { padding: '5px 8px 5px 0', color: 'var(--text-secondary)', borderBottom: '1px solid var(--rgba(255,255,255,0.08))', verticalAlign: 'middle' };
const inlineInputStyle: React.CSSProperties = { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px', padding: '2px 6px', fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box' };
const ghostBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const addRowBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, marginTop: 'var(--space-2)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', fontSize: '11px', padding: 0, fontFamily: 'var(--font-sans)' };
const textareaStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', lineHeight: 1.6 };
