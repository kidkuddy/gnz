import React from 'react';
import { useProductStore } from '../stores/product-store';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
}

export function ProductInitView({ workspaceId }: Props) {
  const initProduct = useProductStore((s) => s.initProduct);
  const saving = useProductStore((s) => s.saving);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await initProduct(workspaceId, name.trim(), description.trim());
    } catch (e) {
      toast.error(`Failed to create PRODUCT.md: ${e}`);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={titleStyle}>Create PRODUCT.md</div>
        <div style={subtitleStyle}>No product spec found in this workspace. Start one now.</div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Product name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. gnz"
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Short description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="What does this product do?"
            style={inputStyle}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          style={{
            ...btnStyle,
            opacity: !name.trim() || saving ? 0.4 : 1,
            cursor: !name.trim() || saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Creating…' : 'Create PRODUCT.md'}
        </button>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 'var(--space-8)' };
const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };
const titleStyle: React.CSSProperties = { fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' };
const subtitleStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', marginTop: -8 };
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' };
const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.08em' };
const inputStyle: React.CSSProperties = { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', padding: '8px var(--space-3)', fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: '13px',
  padding: '6px 0',
  fontFamily: 'var(--font-sans)',
  alignSelf: 'flex-start',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};
