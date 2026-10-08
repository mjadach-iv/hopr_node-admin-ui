import styled from '@emotion/styled';
import { useAppSelector } from '../../../store';
import Tooltip from '../../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import type { PacketStats } from '../../../store/slices/node/initialState';
import { formatCount, hoprPacketSize } from '../../../utils/metrics';
import { WithUnit } from '../../../components/Unit';

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];

// scaled so the number stays within 1-999, checked after rounding so 999.999 kB becomes 1.00 MB
export const formatBytes = (bytes: number): string => {
  let value = bytes;
  let unit = 0;
  while (unit < UNITS.length - 1 && Number(value.toFixed(2)) >= 1000) {
    value /= 1000;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${UNITS[unit]}`;
};

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  th,
  td {
    height: 30px;
    padding: 0;
    border-top: 1px solid var(--border);
    text-align: right;
    white-space: nowrap;
  }
  thead th {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--muted);
  }
  th:first-of-type {
    text-align: left;
    font-weight: 400;
    color: var(--text-2);
  }
  td {
    font-weight: 550;
  }
  td.rate {
    color: var(--muted);
    font-weight: 450;
  }
`;

export type TrafficRow = {
  label: string;
  tip: string;
  packets: string;
  packetRate: string;
  bytes: string;
  byteRate: string;
};

/** Sent / received / relayed packets and the data they carry, totals and 5 s rates. */
export function useTraffic(): { rows: TrafficRow[]; estimate: string } {
  const packets = useAppSelector((store) => store.node.metricsParsed.packets);
  const version = useAppSelector((store) => store.node.version.data);
  const packetSize = hoprPacketSize(version);
  const estimate = packetSize
    ? `Data is counted from packets at ${packetSize} bytes each, the fixed HOPR packet size for this node version. Rates are averages over the last 5 seconds.`
    : 'Unknown packet size for this node version.';

  const row = (label: string, tip: string, stats: PacketStats): TrafficRow => ({
    label,
    tip,
    packets: formatCount(stats.latest?.data ?? null),
    packetRate: stats.perSecond === null ? '-' : `${stats.perSecond.toFixed(1)}/s`,
    bytes: packetSize && stats.latest ? formatBytes(Number(stats.latest.data) * packetSize) : '-',
    byteRate: packetSize && stats.perSecond !== null ? `${formatBytes(stats.perSecond * packetSize)}/s` : '-',
  });

  return {
    estimate,
    rows: [
      row('Sent', 'Packets this node sent', packets.sent),
      row('Received', 'Packets this node received', packets.received),
      row('Relayed', 'Packets this node relayed for others', packets.forwarded),
    ],
  };
}

function Traffic() {
  const { rows, estimate } = useTraffic();
  return (
    <Table>
      <thead>
        <tr>
          <th />
          <th>Packets</th>
          <th>Rate</th>
          <Tooltip
            title={estimate}
            notWide
          >
            <th>Data</th>
          </Tooltip>
          <th>Throughput</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <Tooltip
              title={row.tip}
              notWide
              placement="left"
            >
              <th>{row.label}</th>
            </Tooltip>
            <td>{row.packets}</td>
            <td className="rate">
              <WithUnit text={row.packetRate} />
            </td>
            <td>
              <WithUnit text={row.bytes} />
            </td>
            <td className="rate">
              <WithUnit text={row.byteRate} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default Traffic;
