import type { PacketCounter } from '../store/slices/node/initialState';

/** Packets per second between two counter samples, null across a counter reset (node restart). */
export const packetRate = (previous: PacketCounter, latest: PacketCounter): number | null => {
  const deltaSec = (latest.timestamp - previous.timestamp) / 1000;
  const deltaPackets = Number(latest.data) - Number(previous.data);
  if (deltaSec <= 0 || deltaPackets < 0) return null;
  return deltaPackets / deltaSec;
};

/** Bytes per HOPR packet on the wire (HoprPacket::SIZE: sphinx packet + ticket), per hoprd v4.0.0-rc.4 and v5.0.0-rc.5. */
export const hoprPacketSize = (version: string | null): number | null => {
  const major = Number(version?.match(/\d+/)?.[0]);
  if (major === 4) return 1459;
  if (major >= 5) return 3669;
  return null;
};

export const formatCount = (value: string | number | null): string => {
  if (value === null) return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return value.toString();
  const abs = Math.abs(n);
  if (abs < 1_000) return n.toString();
  if (abs < 1_000_000) return `${(n / 1_000).toFixed(2)}k`;
  if (abs < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs < 1_000_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  return `${(n / 1_000_000_000_000).toFixed(2)}T`;
};

type ParsedMetricsType = Record<string, { categories: string[]; data: unknown[] } | undefined>;

/** Value of one series of a parsed metric, category is e.g. '' for a plain gauge, 'sum' or '{valid="true"}'. */
export const metricValue = (parsed: ParsedMetricsType, key: string, category = ''): number | null => {
  const metric = parsed[key];
  if (!metric) return null;
  const index = metric.categories.indexOf(category);
  if (index === -1) return null;
  const value = metric.data[index];
  return typeof value === 'number' ? value : null;
};

/** Series of a parsed metric keyed by the value of one label, e.g. reason="undecodable" -> { undecodable: n }. */
export const metricByLabel = (parsed: ParsedMetricsType, key: string, label: string): Record<string, number> => {
  const metric = parsed[key];
  const result: Record<string, number> = {};
  if (!metric) return result;
  const labelRegex = new RegExp(`${label}="([^"]*)"`);
  metric.categories.forEach((category, i) => {
    const match = category.match(labelRegex);
    const value = metric.data[i];
    if (match && typeof value === 'number') result[match[1]] = value;
  });
  return result;
};

/**
 * Parses Node metrics to Apex charts ready data.
 * @param data The string of metrics from HOPRd.
 * @returns Apex chart ready {}.
 */
const ensureEntry = (parsed: any, key: string) => {
  if (!parsed[key]) {
    parsed[key] = {
      name: '',
      type: '',
      data: [],
      categories: [],
      length: 0,
    };
  }
  return parsed[key];
};

export const parseMetrics = (data: string) => {
  const parsed: any = {};
  const tmp = data.split('\n');
  let lastKey = '';
  for (let i = 0; i < tmp.length; i++) {
    const line = tmp[i];
    if (!line) continue;
    const string = line.split(' ');

    if (string[0] === '#' && string[1] === 'HELP') {
      const key = (lastKey = string[2]);
      ensureEntry(parsed, key).name = line.replace(`# HELP ${key} `, '');
    } else if (string[0] === '#' && string[1] === 'TYPE') {
      const key = (lastKey = string[2]);
      ensureEntry(parsed, key).type = line.replace(`# TYPE ${key} `, '');
    } else {
      if (!lastKey || !parsed[lastKey]) continue;
      const parsedData = parseFloat(string[string.length - 1]);
      if (!Number.isNaN(parsedData)) parsed[lastKey].data.push(parsedData);
      const category = string[0].replace(lastKey, '').replace(/^_/, '');
      parsed[lastKey].categories.push(category);
      parsed[lastKey].length++;
    }
  }

  return parsed;
};
