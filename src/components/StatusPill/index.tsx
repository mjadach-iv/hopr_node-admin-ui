import styled from '@emotion/styled';

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 18px;
  padding: 0 7px;
  border-radius: 9px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  color: var(--text-2);
  background: var(--surface-2);
  border: 1px solid var(--border);
  &::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }
  &.tone-green {
    color: var(--green);
    background: var(--green-soft);
    border-color: transparent;
  }
  &.tone-orange {
    color: var(--orange);
    background: var(--orange-soft);
    border-color: transparent;
  }
  &.tone-red {
    color: var(--red);
    background: var(--red-soft);
    border-color: transparent;
  }
`;

const toneOf = (status: string) => {
  const s = status.toLowerCase();
  if (s.startsWith('open') || s === 'green' || s === 'online' || s === 'ready') return 'green';
  if (s.startsWith('pending') || s === 'orange' || s === 'yellow') return 'orange';
  if (s.startsWith('closed') || s === 'red') return 'red';
  return 'neutral';
};

/**
 * Colored dot + label for channel and connectivity states. The text after a
 * '·' (like 'closable now') is shown as a muted suffix.
 */
export const StatusPill = ({ status }: { status?: string | null }) => {
  if (!status) return <>-</>;
  const [main, ...rest] = status.split(' · ');
  return (
    <Pill className={`StatusPill tone-${toneOf(main)}`}>
      {main}
      {rest.length > 0 && <span style={{ fontWeight: 400 }}>· {rest.join(' · ')}</span>}
    </Pill>
  );
};

export default StatusPill;
