/**
 * One node as measured by the HOPR network dashboard. Availability is a 0..1
 * share, latency is ms, timestamps are epoch ms and throughput is Mbps. Null
 * means the dashboard has no figure - rendered as '-'.
 */
export type NodeStatsType = {
  address: string;
  availability24h: number | null;
  availability7d: number | null;
  availability30d: number | null;
  latency: number | null;
  firstSeen: number | null;
  lastSeen: number | null;
  version: string | null;
  lastThroughput: number | null;
  maxLastThroughput: number | null;
  lastMeasuredAt: number | null;
  throughput24h: number | null;
  maxThroughput24h: number | null;
};

export type NodesStatsType = {
  // keyed by checksummed address
  byAddress: Record<string, NodeStatsType>;
  // end of the dashboard run the figures come from
  lastRun: number | null;
};
