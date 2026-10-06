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
