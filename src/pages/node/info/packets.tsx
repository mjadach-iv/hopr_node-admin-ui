import { useAppSelector } from '../../../store';
import { TableExtended } from '../../../future-hopr-lib-components/Table/columed-data';
import Tooltip from '../../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import type { PacketStats } from '../../../store/slices/node/initialState';

const formatCount = (value: string | null): string => {
  if (value === null) return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const abs = Math.abs(n);
  if (abs < 1_000) return n.toString();
  if (abs < 1_000_000) return `${(n / 1_000).toFixed(2)}k`;
  if (abs < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs < 1_000_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  return `${(n / 1_000_000_000_000).toFixed(2)}T`;
};

const formatPacketStats = (stats: PacketStats) => {
  const total = formatCount(stats.latest?.data ?? null);
  return stats.perSecond === null ? `Total: ${total}` : `Total: ${total} / ${stats.perSecond.toFixed(2)} p/s`;
};

function Packets() {
  const sent = useAppSelector((store) => store.node.metricsParsed.packets.sent);
  const received = useAppSelector((store) => store.node.metricsParsed.packets.received);
  const forwarded = useAppSelector((store) => store.node.metricsParsed.packets.forwarded);

  return (
    <TableExtended
      title="Packets"
      style={{ marginBottom: '42px' }}
    >
      <tbody>
        <tr>
          <th>
            <Tooltip
              title="Packets sent — total followed by the average per-second rate over the last 5 seconds"
              notWide
            >
              <span>Sent</span>
            </Tooltip>
          </th>
          <td>{formatPacketStats(sent)}</td>
        </tr>
        <tr>
          <th>
            <Tooltip
              title="Packets received — total followed by the average per-second rate over the last 5 seconds"
              notWide
            >
              <span>Received</span>
            </Tooltip>
          </th>
          <td>{formatPacketStats(received)}</td>
        </tr>
        <tr>
          <th>
            <Tooltip
              title="Packets relayed — total followed by the average per-second rate over the last 5 seconds"
              notWide
            >
              <span>Relayed</span>
            </Tooltip>
          </th>
          <td>{formatPacketStats(forwarded)}</td>
        </tr>
      </tbody>
    </TableExtended>
  );
}

export default Packets;
