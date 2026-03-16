import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, X, ArrowLeft } from 'lucide-react';
import { Checkbox } from '../components/Checkbox';
import { useProductStore } from '../stores/product-store';
import type { ProductFeature, ProductDomain } from '../stores/product-store';
import { toast } from 'sonner';

export const STATE_COLORS: Record<string, string> = {
  planned: '#4a4a4a',
  'in-progress': '#3d6b5a',
  done: '#3d5a3d',
  deprecated: '#5a3d3d',
};

const FEATURE_STATES = ['planned', 'in-progress', 'done', 'deprecated'] as const;
type FeatureState = (typeof FEATURE_STATES)[number];

// ─── Domain overview (list of features as rows) ────────────────────────────

export function DomainContent({
  domain,
  onFeatureSelect,
}: {
  domain: ProductDomain;
  onFeatureSelect: (featureName: string) => void;
}) {
  return (
    <div style={panelStyle}>
      {/* Domain header */}
      <div style={domainHeaderStyle}>
        <div style={domainTitleStyle}>{domain.name}</div>
        {domain.summary && (
          <div style={domainSummaryStyle}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{children}</span>,
                code: ({ children }) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>{children}</code>,
              }}
            >
              {domain.summary}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Feature rows */}
      <div style={featureListStyle}>
        <div style={featureListHeaderStyle}>
          <span>Features</span>
          <span style={{ color: 'var(--text-disabled)' }}>{domain.features.length}</span>
        </div>

        {domain.features.length === 0 && (
          <div style={noFeaturesStyle}>No features yet — add one from the nav</div>
        )}

        {domain.features.map((feat) => (
          <FeatureRow
            key={feat.name}
            feature={feat}
            onClick={() => onFeatureSelect(feat.name)}
          />
        ))}
      </div>
    </div>
  );
}

function FeatureRow({ feature, onClick }: { feature: ProductFeature; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);
  const stateColor = STATE_COLORS[feature.state] ?? '#4a4a4a';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: '10px 20px',
        cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderLeft: `3px solid ${hovered ? stateColor : 'transparent'}`,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        transition: 'all 80ms ease',
      }}
    >
      <div style={{ paddingTop: 2, flexShrink: 0 }}>
        <span style={{
          display: 'inline-block',
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: stateColor,
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: feature.why ? 3 : 0 }}>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{feature.name}</span>
          <StatePill state={feature.state} />
          {feature.issues.length > 0 && (
            <span style={{ fontSize: '10px', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
              {feature.issues.length} issue{feature.issues.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {feature.why && (
          <div style={{ fontSize: '12px', color: 'var(--text-disabled)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {feature.why}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Feature detail (full content area) ───────────────────────────────────

export function FeatureContent({
  domain,
  feature,
  workspaceId,
  onBack,
}: {
  domain: string;
  feature: ProductFeature;
  workspaceId: string;
  onBack: () => void;
}) {
  const updateFeature = useProductStore((s) => s.updateFeature);
  const [draft, setDraft] = React.useState<ProductFeature>({ ...feature });
  const [editMode, setEditMode] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newAcceptance, setNewAcceptance] = React.useState('');
  const [newDep, setNewDep] = React.useState('');

  React.useEffect(() => {
    setDraft({ ...feature });
    setEditMode(false);
  }, [feature.name, domain]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateFeature(workspaceId, domain, feature.name, draft);
      setEditMode(false);
    } catch {
      toast.error('Failed to save feature');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={featureHeaderStyle}>
        <button onClick={onBack} style={backBtnStyle}>
          <ArrowLeft size={13} />
          <span>{domain}</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <h1 style={featureTitleStyle}>{feature.name}</h1>
          <StatePill state={feature.state} large />
        </div>
      </div>

      <div style={featureBodyStyle}>
        {/* Edit/Save toolbar */}
        <div style={toolbarStyle}>
          {editMode ? (
            <>
              <button onClick={() => { setDraft({ ...feature }); setEditMode(false); }} style={ghostBtnTextStyle}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={saveBtnStyle}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)} style={editBtnStyle}>Edit feature</button>
          )}
        </div>

        {/* State (edit only — view shows it in header) */}
        {editMode && (
          <Field label="State">
            <select value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} style={selectStyle}>
              {FEATURE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              {draft.state && !FEATURE_STATES.includes(draft.state as FeatureState) && (
                <option value={draft.state}>{draft.state}</option>
              )}
            </select>
          </Field>
        )}

        {/* Why */}
        <Field label="Why">
          {editMode ? (
            <textarea value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })} rows={3} placeholder="Why does this feature exist?" style={textareaStyle} />
          ) : feature.why ? (
            <ProseSmall content={feature.why} />
          ) : (
            <span style={emptyFieldStyle}>—</span>
          )}
        </Field>

        {/* Notes */}
        <Field label="Notes">
          {editMode ? (
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} placeholder="Implementation notes…" style={textareaStyle} />
          ) : feature.notes ? (
            <ProseSmall content={feature.notes} />
          ) : (
            <span style={emptyFieldStyle}>—</span>
          )}
        </Field>

        {/* Acceptance criteria */}
        {(editMode || feature.acceptance.length > 0) && (
          <Field label="Acceptance criteria">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(editMode ? draft.acceptance : feature.acceptance).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ paddingTop: 1, flexShrink: 0 }}>
                    <Checkbox checked={false} onChange={() => {}} />
                  </div>
                  {editMode ? (
                    <>
                      <input
                        value={draft.acceptance[i] ?? a}
                        onChange={(e) => setDraft({ ...draft, acceptance: draft.acceptance.map((aa, ii) => ii === i ? e.target.value : aa) })}
                        style={{ ...inlineInputStyle, flex: 1 }}
                      />
                      <button onClick={() => setDraft({ ...draft, acceptance: draft.acceptance.filter((_, ii) => ii !== i) })} style={ghostIconBtnStyle}><X size={11} /></button>
                    </>
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, lineHeight: 1.5 }}>{a}</span>
                  )}
                </div>
              ))}
              {editMode && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={newAcceptance}
                    onChange={(e) => setNewAcceptance(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newAcceptance.trim()) {
                        setDraft({ ...draft, acceptance: [...draft.acceptance, newAcceptance.trim()] });
                        setNewAcceptance('');
                      }
                    }}
                    placeholder="when X, then Y…"
                    style={{ ...inlineInputStyle, flex: 1 }}
                  />
                  <button onClick={() => { if (newAcceptance.trim()) { setDraft({ ...draft, acceptance: [...draft.acceptance, newAcceptance.trim()] }); setNewAcceptance(''); } }} style={ghostIconBtnStyle}><Plus size={11} /></button>
                </div>
              )}
            </div>
          </Field>
        )}

        {/* Depends on */}
        {(editMode || feature.depends_on.length > 0) && (
          <Field label="Depends on">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: editMode ? 6 : 0 }}>
              {(editMode ? draft.depends_on : feature.depends_on).map((dep, i) => (
                <span key={i} style={depTagStyle}>
                  {dep}
                  {editMode && (
                    <button onClick={() => setDraft({ ...draft, depends_on: draft.depends_on.filter((_, ii) => ii !== i) })} style={{ ...ghostIconBtnStyle, marginLeft: 2 }}><X size={9} /></button>
                  )}
                </span>
              ))}
            </div>
            {editMode && (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={newDep}
                  onChange={(e) => setNewDep(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newDep.trim()) {
                      setDraft({ ...draft, depends_on: [...draft.depends_on, newDep.trim()] });
                      setNewDep('');
                    }
                  }}
                  placeholder="Feature name…"
                  style={{ ...inlineInputStyle, flex: 1 }}
                />
              </div>
            )}
          </Field>
        )}

        {/* Files */}
        {feature.files.length > 0 && (
          <Field label="Files">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {feature.files.map((f) => (
                <code key={f} style={fileTagStyle}>{f}</code>
              ))}
            </div>
          </Field>
        )}

        {/* Issues */}
        {feature.issues.length > 0 && (
          <Field label="Issues">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {feature.issues.map((ref) => (
                <span key={ref} style={issueTagStyle}>{ref}</span>
              ))}
            </div>
          </Field>
        )}
      </div>
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────

function StatePill({ state, large }: { state: string; large?: boolean }) {
  const color = STATE_COLORS[state] ?? '#4a4a4a';
  return (
    <span style={{
      fontSize: large ? '11px' : '10px',
      fontFamily: 'var(--font-mono)',
      color,
      border: `1px solid ${color}`,
      borderRadius: 2,
      padding: large ? '2px 7px' : '1px 5px',
      flexShrink: 0,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {state || 'planned'}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldStyle}>
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function ProseSmall({ content }: { content: string }) {
  if (!content?.trim()) return <span style={emptyFieldStyle}>—</span>;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{children}</p>,
        code: ({ children }) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 2, color: 'var(--text-secondary)' }}>{children}</code>,
        ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: '0 0 6px', color: 'var(--text-secondary)' }}>{children}</ul>,
        li: ({ children }) => <li style={{ fontSize: '13px', lineHeight: 1.55, marginBottom: 2 }}>{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const domainHeaderStyle: React.CSSProperties = {
  padding: '20px 24px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  flexShrink: 0,
};

const domainTitleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: 6,
  letterSpacing: '-0.01em',
};

const domainSummaryStyle: React.CSSProperties = {
  lineHeight: 1.6,
};

const featureListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};

const featureListHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 20px 8px',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--text-disabled)',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
};

const noFeaturesStyle: React.CSSProperties = {
  padding: '20px',
  fontSize: '13px',
  color: 'var(--text-disabled)',
};

const featureHeaderStyle: React.CSSProperties = {
  padding: '16px 24px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  flexShrink: 0,
};

const featureTitleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  margin: 0,
  letterSpacing: '-0.01em',
};

const backBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  background: 'none',
  border: 'none',
  color: 'var(--text-disabled)',
  fontSize: '11px',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'var(--font-sans)',
};

const featureBodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0 24px 24px',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '12px 0',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  marginBottom: 20,
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 24,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--text-disabled)',
  marginBottom: 8,
};

const emptyFieldStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-disabled)',
};

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: '12px',
  padding: '5px 8px',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: '13px',
  padding: '8px 10px',
  fontFamily: 'var(--font-sans)',
  resize: 'vertical',
  outline: 'none',
  lineHeight: 1.55,
};

const inlineInputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: '13px',
  padding: '5px 8px',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const ghostIconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-disabled)',
  padding: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const ghostBtnTextStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-tertiary)',
  fontSize: '12px',
  padding: '4px 8px',
  fontFamily: 'var(--font-sans)',
};

const editBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 2,
  cursor: 'pointer',
  color: 'var(--text-tertiary)',
  fontSize: '12px',
  padding: '4px 12px',
  fontFamily: 'var(--font-sans)',
};

const saveBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 2,
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontSize: '12px',
  padding: '4px 14px',
  fontFamily: 'var(--font-sans)',
};

const depTagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 2,
  fontSize: '12px',
  color: 'var(--text-tertiary)',
  padding: '2px 7px',
  fontFamily: 'var(--font-mono)',
};

const fileTagStyle: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
  background: 'rgba(255,255,255,0.04)',
  padding: '2px 5px',
  borderRadius: 2,
};

const issueTagStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-tertiary)',
  fontFamily: 'var(--font-mono)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 2,
  padding: '1px 6px',
};
