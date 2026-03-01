interface PlanModeBannerProps {
  active: boolean;
}

export function PlanModeBanner({ active }: PlanModeBannerProps) {
  if (!active) return null;

  return (
    <div
      style={{
        padding: '4px 12px',
        background: 'var(--bg-hover)',
        borderBottom: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span>◈</span>
      <span>Plan mode — read-only exploration</span>
    </div>
  );
}
