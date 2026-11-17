import type { EarningsBucket, EarningsBucketSize, EarningsSplit } from '../src/indexer/types';

export const BUCKET_SECONDS: Record<EarningsBucketSize, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '1d': 24 * 60 * 60,
  '1w': 7 * 24 * 60 * 60,
};
// keeps a response and the chart drawing it small
export const MAX_BUCKETS = 5_000;

const DAY = BUCKET_SECONDS['1d'];

export const isBucketSize = (value: unknown): value is EarningsBucketSize =>
  typeof value === 'string' && value in BUCKET_SECONDS;

export const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Seconds the time zone is ahead of UTC at a unix time, cached per hour as it only changes on the hour. */
const offsetsOf = (tz: string) => {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const cache = new Map<number, number>();
  return (ts: number) => {
    const hour = Math.floor(ts / 3600);
    let offset = cache.get(hour);
    if (offset === undefined) {
      const parts = Object.fromEntries(format.formatToParts(hour * 3600 * 1000).map((p) => [p.type, Number(p.value)]));
      const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) / 1000;
      offset = local - hour * 3600;
      cache.set(hour, offset);
    }
    return offset;
  };
};

/**
 * Sums the redemptions per bucket and per node: earned, CT being the tickets whose channel source is
 * a CT node, and spent, the tickets the nodes paid. Buckets start on the viewer's clock: days at
 * local midnight, weeks on Monday.
 */
export const aggregate = ({
  rows,
  spentRows,
  nodes,
  ctNodes,
  bucket,
  from,
  to,
  tz,
}: {
  rows: { destination: string; source: string | null; ts: number; amount: string }[];
  spentRows: { source: string; ts: number; amount: string }[];
  // as requested, matched to the rows in lowercase
  nodes: string[];
  ctNodes: string[];
  bucket: EarningsBucketSize;
  from: number;
  to: number;
  tz: string;
}): { buckets: EarningsBucket[]; totals: Record<string, EarningsSplit> } | { error: string } => {
  const size = BUCKET_SECONDS[bucket];
  const offset = offsetsOf(tz);
  const startOf = (ts: number) => {
    const local = ts + offset(ts);
    const localStart =
      bucket === '1w'
        ? // 1970-01-01 was a Thursday, 3 days after a Monday
          (Math.floor(local / DAY) - ((Math.floor(local / DAY) + 3) % 7)) * DAY
        : Math.floor(local / size) * size;
    return localStart - offset(localStart - offset(ts));
  };
  // a local day or week is an hour longer or shorter when the clock changes, so it is found again
  const next = (start: number) => (size < DAY ? start + size : startOf(start + size + 2 * 3600));

  const starts: number[] = [];
  for (let t = startOf(from); t < to; t = next(t)) {
    starts.push(t);
    if (starts.length > MAX_BUCKETS) return { error: `More than ${MAX_BUCKETS} buckets, pick a larger bucket` };
  }
  const indexOf = new Map(starts.map((t, i) => [t, i]));
  const zero = () => ({ ct: BigInt(0), traffic: BigInt(0), spent: BigInt(0) });
  const sums = starts.map(zero);
  const keyOf = new Map(nodes.map((node) => [node.toLowerCase(), node]));
  const totals = new Map(nodes.map((node) => [node, zero()]));
  const ct = new Set(ctNodes.map((node) => node.toLowerCase()));

  for (const row of rows) {
    const kind = row.source && ct.has(row.source) ? 'ct' : 'traffic';
    const amount = BigInt(row.amount);
    const index = indexOf.get(startOf(row.ts));
    if (index !== undefined) sums[index][kind] += amount;
    const total = totals.get(keyOf.get(row.destination) ?? '');
    if (total) total[kind] += amount;
  }
  for (const row of spentRows) {
    const amount = BigInt(row.amount);
    const index = indexOf.get(startOf(row.ts));
    if (index !== undefined) sums[index].spent += amount;
    const total = totals.get(keyOf.get(row.source) ?? '');
    if (total) total.spent += amount;
  }

  const strings = (sum: ReturnType<typeof zero>): EarningsSplit => ({
    ct: sum.ct.toString(),
    traffic: sum.traffic.toString(),
    spent: sum.spent.toString(),
  });
  return {
    buckets: starts.map((t, i) => ({ t, ...strings(sums[i]) })),
    totals: Object.fromEntries([...totals].map(([node, sum]) => [node, strings(sum)])),
  };
};
