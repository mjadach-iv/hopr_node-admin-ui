import { useState, useEffect } from 'react';
import { useAppSelector } from '../../../store';

const format = (nodeStartedEpoch: number) => {
  if (!nodeStartedEpoch || typeof nodeStartedEpoch !== 'number') return '-';
  const uptimeSec = Math.floor((Date.now() - Math.floor(nodeStartedEpoch * 1000)) / 1000);
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

/** Node uptime as '2d 4h 10m', ticking every second. */
export function useUptime() {
  const nodeStartedEpoch = useAppSelector(
    (store) => store.node.metrics.data.parsed?.hopr_start_time?.data[0],
  ) as number;
  const [uptime, set_uptime] = useState(format(nodeStartedEpoch));

  useEffect(() => {
    set_uptime(format(nodeStartedEpoch));
    const interval = setInterval(() => set_uptime(format(nodeStartedEpoch)), 1_000);
    return () => clearInterval(interval);
  }, [nodeStartedEpoch]);

  return uptime;
}
