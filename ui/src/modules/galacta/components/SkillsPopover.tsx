import { useEffect, useRef } from 'react';
import { useGalactaStore, type Skill } from '../stores/galacta-store';

interface SkillsPopoverProps {
  open: boolean;
  onClose: () => void;
  workingDir: string;
  onSelectSkill: (skill: Skill) => void;
}

export function SkillsPopover({ open, onClose, workingDir, onSelectSkill }: SkillsPopoverProps) {
  const skills = useGalactaStore(s => s.skills);
  const loadSkills = useGalactaStore(s => s.loadSkills);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && workingDir) loadSkills(workingDir);
  }, [open, workingDir]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        width: 280,
        maxHeight: 320,
        overflow: 'auto',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        zIndex: 100,
        padding: 4,
      }}
    >
      {skills.length === 0 ? (
        <div style={{
          padding: '12px 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}>
          No skills found
        </div>
      ) : (
        skills.map(skill => (
          <button
            key={skill.name}
            onClick={() => { onSelectSkill(skill); onClose(); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'var(--font-mono)',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>/{skill.name}</div>
            {skill.description && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {skill.description}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  );
}
