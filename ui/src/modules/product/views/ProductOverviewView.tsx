import React from 'react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useProductStore } from '../stores/product-store';
import { ProductInitView } from './ProductInitView';
import { SpecTab } from './SpecTab';
import { IssuesTab } from './IssuesTab';
import { DomainContent, FeatureContent } from './DomainsTab';
import type { Tab } from '../../../stores/tab-store';
import { Plus } from 'lucide-react';

type ActiveView =
  | { kind: 'spec' }
  | { kind: 'domain'; domain: string }
  | { kind: 'feature'; domain: string; feature: string }
  | { kind: 'issues' };

interface Props {
  tab: Tab;
}

export function ProductOverviewView({ tab }: Props) {
  const workspaceId = (tab.data?.workspaceId as string | undefined) ?? '';
  const initialSection = (tab.data?.initialSection as string | undefined) ?? 'spec';

  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const { product, notFound, loading } = useProductStore();
  const load = useProductStore((s) => s.load);
  const createFeature = useProductStore((s) => s.createFeature);

  const wsId = workspaceId || activeWorkspace?.id || '';

  const initialView: ActiveView = initialSection === 'issues'
    ? { kind: 'issues' }
    : initialSection === 'domains'
    ? { kind: 'domain', domain: '' }
    : { kind: 'spec' };

  const [active, setActive] = React.useState<ActiveView>(initialView);
  const [addingFeatureDomain, setAddingFeatureDomain] = React.useState<string | null>(null);
  const [newFeatureName, setNewFeatureName] = React.useState('');
  const [expandedDomains, setExpandedDomains] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (wsId) load(wsId).catch(() => {});
  }, [wsId, load]);

  // Auto-expand all domains on load
  React.useEffect(() => {
    if (product?.domains) {
      setExpandedDomains(new Set(product.domains.map((d) => d.name)));
    }
  }, [product?.domains?.length]);

  if (!wsId) return <div style={emptyStyle}>Select a workspace first</div>;
  if (loading) return <div style={emptyStyle}>Loading…</div>;
  if (notFound) return <ProductInitView workspaceId={wsId} />;
  if (!product) return null;

  const handleAddFeature = async (domainName: string) => {
    if (!newFeatureName.trim()) return;
    try {
      await createFeature(wsId, domainName, { name: newFeatureName.trim(), state: 'planned' });
      setNewFeatureName('');
      setAddingFeatureDomain(null);
      setActive({ kind: 'feature', domain: domainName, feature: newFeatureName.trim() });
    } catch {
      // error handled in store
    }
  };

  const toggleDomain = (name: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Determine content to show
  const renderContent = () => {
    switch (active.kind) {
      case 'spec':
        return <SpecTab workspaceId={wsId} />;
      case 'issues':
        return <IssuesTab workspaceId={wsId} />;
      case 'domain': {
        const domain = product.domains.find((d) => d.name === active.domain);
        if (!domain) {
          // Show first domain or prompt
          if (product.domains.length > 0) {
            return <DomainContent domain={product.domains[0]} onFeatureSelect={(f) => setActive({ kind: 'feature', domain: product.domains[0].name, feature: f })} />;
          }
          return <div style={emptyStyle}>No domains defined in PRODUCT.md</div>;
        }
        return <DomainContent domain={domain} onFeatureSelect={(f) => setActive({ kind: 'feature', domain: domain.name, feature: f })} />;
      }
      case 'feature': {
        const domain = product.domains.find((d) => d.name === active.domain);
        const feature = domain?.features.find((f) => f.name === active.feature);
        if (!feature || !domain) return <div style={emptyStyle}>Feature not found</div>;
        return (
          <FeatureContent
            domain={domain.name}
            feature={feature}
            workspaceId={wsId}
            onBack={() => setActive({ kind: 'domain', domain: domain.name })}
          />
        );
      }
    }
  };

  return (
    <div style={rootStyle}>
      {/* Left nav */}
      <nav style={navStyle}>
        {/* Spec */}
        <NavItem
          label="Spec"
          active={active.kind === 'spec'}
          onClick={() => setActive({ kind: 'spec' })}
          indent={0}
        />

        {/* Domains tree */}
        <div style={navGroupLabelStyle}>Domains</div>
        {product.domains.length === 0 && (
          <div style={navEmptyStyle}>No domains</div>
        )}
        {product.domains.map((domain) => {
          const isExpanded = expandedDomains.has(domain.name);
          const isDomainActive = active.kind === 'domain' && active.domain === domain.name;
          return (
            <React.Fragment key={domain.name}>
              <div
                onClick={() => {
                  toggleDomain(domain.name);
                  setActive({ kind: 'domain', domain: domain.name });
                }}
                style={{
                  ...navDomainRowStyle,
                  color: isDomainActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderLeft: `2px solid ${isDomainActive ? 'var(--text-tertiary)' : 'transparent'}`,
                }}
              >
                <span style={{ color: 'var(--text-disabled)', fontSize: '9px', width: 12, textAlign: 'center', flexShrink: 0 }}>
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domain.name}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-disabled)' }}>{domain.features.length}</span>
              </div>

              {isExpanded && domain.features.map((feat) => {
                const isFeatActive = active.kind === 'feature' && active.domain === domain.name && active.feature === feat.name;
                return (
                  <div
                    key={feat.name}
                    onClick={() => setActive({ kind: 'feature', domain: domain.name, feature: feat.name })}
                    style={{
                      ...navFeatureRowStyle,
                      color: isFeatActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      background: isFeatActive ? 'rgba(255,255,255,0.03)' : 'transparent',
                      borderLeft: `2px solid ${isFeatActive ? STATE_COLORS[feat.state] ?? 'var(--text-disabled)' : 'transparent'}`,
                    }}
                  >
                    <span style={{ width: 12, flexShrink: 0 }} />
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATE_COLORS[feat.state] ?? '#3a3a3a', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 4 }}>{feat.name}</span>
                  </div>
                );
              })}

              {isExpanded && (
                addingFeatureDomain === domain.name ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 26px' }}>
                    <input
                      autoFocus
                      value={newFeatureName}
                      onChange={(e) => setNewFeatureName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddFeature(domain.name);
                        if (e.key === 'Escape') { setAddingFeatureDomain(null); setNewFeatureName(''); }
                      }}
                      placeholder="Feature name…"
                      style={navInputStyle}
                    />
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingFeatureDomain(domain.name); }}
                    style={navAddBtnStyle}
                  >
                    <Plus size={9} /> add
                  </button>
                )
              )}
            </React.Fragment>
          );
        })}

        {/* Issues */}
        <div style={{ marginTop: 'var(--space-3)' }}>
          <NavItem
            label="Issues"
            active={active.kind === 'issues'}
            onClick={() => setActive({ kind: 'issues' })}
            indent={0}
          />
        </div>
      </nav>

      {/* Content */}
      <div style={contentStyle}>
        {renderContent()}
      </div>
    </div>
  );
}

const STATE_COLORS: Record<string, string> = {
  planned: '#4a4a4a',
  'in-progress': '#3d6b5a',
  done: '#3d5a3d',
  deprecated: '#5a3d3d',
};

function NavItem({ label, active: isActive, onClick, indent }: { label: string; active: boolean; onClick: () => void; indent: number }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: `5px 12px 5px ${12 + indent * 12}px`,
        fontSize: '12px',
        cursor: 'pointer',
        color: isActive ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-tertiary)',
        borderLeft: `2px solid ${isActive ? 'var(--text-tertiary)' : 'transparent'}`,
        background: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
        fontWeight: isActive ? 500 : 400,
        transition: 'color 80ms ease',
        userSelect: 'none',
      }}
    >
      {label}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  overflow: 'hidden',
};

const navStyle: React.CSSProperties = {
  width: 200,
  flexShrink: 0,
  borderRight: '1px solid rgba(255,255,255,0.08)',
  overflowY: 'auto',
  padding: '8px 0',
  display: 'flex',
  flexDirection: 'column',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

const navGroupLabelStyle: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--text-disabled)',
  padding: '12px 12px 4px',
};

const navEmptyStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-disabled)',
  padding: '4px 12px 4px 26px',
};

const navDomainRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px 5px 10px',
  fontSize: '12px',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'color 80ms ease',
  fontWeight: 500,
};

const navFeatureRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '3px 10px',
  fontSize: '11px',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'color 80ms ease',
  gap: 0,
};

const navAddBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-disabled)',
  fontSize: '10px',
  padding: '2px 8px 4px 26px',
  fontFamily: 'var(--font-sans)',
};

const navInputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: '11px',
  padding: '2px 6px',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-disabled)',
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
};
