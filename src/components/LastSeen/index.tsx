import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { StatusPill } from '../StatusPill';

// a peer heard from within this window counts as online
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const relative = (ms: number) => {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

/**
 * Last-seen table cell: 'Online' when the peer was heard from within the
 * last 5 minutes, otherwise how long ago with the full date in a tooltip,
 * 'Not seen' when never heard from and '-' for the connected node itself.
 */
export const LastSeen = ({ timestamp, self }: { timestamp: number; self?: boolean }) => {
  if (self) return <span>-</span>;
  if (timestamp > 0 && Date.now() - timestamp < ONLINE_WINDOW_MS) {
    return <StatusPill status="Online" />;
  }
  if (!(timestamp > 0)) return <span style={{ color: 'var(--muted)' }}>Not seen</span>;
  const full = new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return (
    <Tooltip title={full}>
      <span style={{ color: 'var(--text-2)' }}>{relative(Date.now() - timestamp)}</span>
    </Tooltip>
  );
};
