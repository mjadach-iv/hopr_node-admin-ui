export const formatAvailability = (share: number | null | undefined): string =>
  typeof share === 'number' ? `${(Math.min(share, 1) * 100).toFixed(1)}%` : '-';

export const formatLatency = (ms: number | null | undefined): string => (typeof ms === 'number' ? `${ms} ms` : '-');

// mbps relayed out of the speed the dashboard tested the node at
export const formatMbps = (mbps: number | null | undefined, maxMbps?: number | null): string => {
  if (typeof mbps !== 'number') return '-';
  if (typeof maxMbps !== 'number' || !maxMbps) return `${mbps.toFixed(1)} Mbps`;
  const percent = Math.min(100, Math.floor((100 * mbps) / maxMbps + 1e-9));
  return `${mbps.toFixed(1)} Mbps (${percent}% of ${maxMbps.toFixed(1)})`;
};

export const CT_ELIGIBILITY_HINT =
  'Throughput is only measured for nodes eligible for Cover Traffic: at least 5 outgoing channels open with min. 100 wxHOPR each';
