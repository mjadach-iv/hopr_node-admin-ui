import { useAppSelector } from '../../../store';
import { TableExtended } from '../../../future-hopr-lib-components/Table/columed-data';
import Tooltip from '../../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import type { PacketStats } from '../../../store/slices/node/initialState';
import { hoprPacketSize } from '../../../utils/metrics';

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];

// scaled so the number stays within 1-999, checked after rounding so 999.999 kB becomes 1.00 MB
const formatBytes = (bytes: number): string => {
  let value = bytes;
  let unit = 0;
  while (unit < UNITS.length - 1 && Number(value.toFixed(2)) >= 1000) {
    value /= 1000;
    unit++;
  }
  return `${value.toFixed(2)} ${UNITS[unit]}`;
};

const formatThroughputStats = (stats: PacketStats, packetSize: number | null) => {
  if (packetSize === null || stats.latest === null) return '-';
  const total = formatBytes(Number(stats.latest.data) * packetSize);
  return stats.perSecond === null
    ? `Total: ${total}`
    : `Total: ${total} / ${formatBytes(stats.perSecond * packetSize)}/s`;
};

function Throughput() {
  const sent = useAppSelector((store) => store.node.metricsParsed.packets.sent);
  const received = useAppSelector((store) => store.node.metricsParsed.packets.received);
  const forwarded = useAppSelector((store) => store.node.metricsParsed.packets.forwarded);
  const version = useAppSelector((store) => store.node.version.data);
  const packetSize = hoprPacketSize(version);
  const estimate = packetSize
    ? `Counted from packets at ${packetSize} bytes each, the fixed HOPR packet size for this node version.`
    : 'Unknown packet size for this node version.';

  return (
    <TableExtended
      title="Throughput"
      style={{ marginBottom: '42px' }}
    >
      <tbody>
        <tr>
          <th>
            <Tooltip
              title={`Data sent — total followed by the average throughput over the last 5 seconds. ${estimate}`}
              notWide
            >
              <span>Sent</span>
            </Tooltip>
          </th>
          <td>{formatThroughputStats(sent, packetSize)}</td>
        </tr>
        <tr>
          <th>
            <Tooltip
              title={`Data received — total followed by the average throughput over the last 5 seconds. ${estimate}`}
              notWide
            >
              <span>Received</span>
            </Tooltip>
          </th>
          <td>{formatThroughputStats(received, packetSize)}</td>
        </tr>
        <tr>
          <th>
            <Tooltip
              title={`Data relayed — total followed by the average throughput over the last 5 seconds. ${estimate}`}
              notWide
            >
              <span>Relayed</span>
            </Tooltip>
          </th>
          <td>{formatThroughputStats(forwarded, packetSize)}</td>
        </tr>
      </tbody>
    </TableExtended>
  );
}

export default Throughput;
