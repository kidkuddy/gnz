import React from 'react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useProductStore } from '../stores/product-store';
import { PanelSection } from '../../../components/layout/Panel';
import type { Tab } from '../../../stores/tab-store';

export function ProductPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const { product, notFound, loading } = useProductStore();
  const load = useProductStore((s) => s.load);
  const addTab = useTabStore((s) => s.addTab);

  React.useEffect(() => {
    if (activeWorkspace) {
      load(activeWorkspace.id).catch(() => {});
    }
  }, [activeWorkspace, load]);

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  const openTab = (initialSection?: string) => {
    addTab({
      id: `product-overview${initialSection ? `-${initialSection}` : ''}`,
      title: product?.name ?? 'Product',
      type: 'product-overview',
      moduleId: 'product',
      data: { workspaceId: activeWorkspace.id, initialSection: initialSection ?? 'spec' },
    } as Tab);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PanelSection title="Product">
        {loading ? (
          <div style={hintStyle}>Loading…</div>
        ) : notFound ? (
          <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
            <div style={hintStyle}>No PRODUCT.md found</div>
            <button onClick={() => openTab()} style={createBtnStyle}>
              + Create PRODUCT.md
            </button>
          </div>
        ) : (
          <NavItem
            label={product?.name ?? 'Overview'}
            sub={product?.description}
            onClick={() => openTab('spec')}
          />
        )}
      </PanelSection>
    </div>
  );
}

function NavItem({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px var(--space-3)',
        cursor: 'pointer',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        borderLeft: '2px solid transparent',
        transition: 'background 80ms ease',
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'var(--text-disabled)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

const hintStyle: React.CSSProperties = {
  padding: '4px var(--space-3)',
  fontSize: '11px',
  color: 'var(--text-disabled)',
};

const createBtnStyle: React.CSSProperties = {
  marginTop: 'var(--space-2)',
  background: 'none',
  border: 'none',
  color: 'var(--text-tertiary)',
  fontSize: '11px',
  padding: '4px var(--space-3)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  width: '100%',
  textAlign: 'left',
};
