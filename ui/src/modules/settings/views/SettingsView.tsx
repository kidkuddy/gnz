import { useSettingsStore } from '../../../stores/settings-store';
import { Badge } from '../../../components/ui/Badge';

const containerStyle: React.CSSProperties = {
  padding: 'var(--space-8)',
  maxWidth: '640px',
  overflow: 'auto',
  height: '100%',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 'var(--space-6)',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 'var(--space-6)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-tertiary)',
  marginBottom: 'var(--space-3)',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-4)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) 0',
  borderBottom: '1px solid var(--border-subtle)',
};

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
};

export function SettingsView() {
  const config = useSettingsStore((s) => s.config);

  if (!config) {
    return (
      <div style={containerStyle}>
        <div style={titleStyle}>Settings</div>
        <div style={{ color: 'var(--text-disabled)', fontSize: '13px' }}>
          Loading configuration...
        </div>
      </div>
    );
  }

  const features = Object.entries(config.features) as [string, boolean][];

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>Settings</div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Feature Flags</div>
        <div style={cardStyle}>
          {features.map(([key, enabled], idx) => (
            <div
              key={key}
              style={{
                ...rowStyle,
                borderBottom: idx === features.length - 1 ? 'none' : rowStyle.borderBottom,
              }}
            >
              <span style={labelStyle}>{key}</span>
              <Badge variant={enabled ? 'success' : 'default'}>
                {enabled ? 'enabled' : 'disabled'}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Supported Databases</div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {config.supported_databases.map((db) => (
              <Badge key={db} variant="accent">{db}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Supported Outputs</div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {config.supported_outputs.map((out) => (
              <Badge key={out} variant="default">{out}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
