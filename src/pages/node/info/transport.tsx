import { useAppSelector } from '../../../store';
import { TableExtended } from '../../../future-hopr-lib-components/Table/columed-data';
import Tooltip from '../../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { formatCount, metricByLabel, metricValue } from '../../../utils/metrics';

const NAT_STATUS = ['Unknown', 'Public', 'Private'];

function Transport() {
  const parsed = useAppSelector((store) => store.node.metrics.data.parsed);

  const natStatus = metricValue(parsed, 'hopr_transport_p2p_nat_status');
  const connections = metricValue(parsed, 'hopr_transport_p2p_active_connection_count');

  const acksSent = metricValue(parsed, 'hopr_protocol_ack_sent_count');
  const acksReceived = metricByLabel(parsed, 'hopr_protocol_ack_received_count', 'valid');
  const acks =
    acksSent === null && acksReceived.true === undefined
      ? '-'
      : `Sent: ${formatCount(acksSent)} / Received: ${formatCount(acksReceived.true ?? null)}` +
        (acksReceived.false ? ` (${formatCount(acksReceived.false)} invalid)` : '');

  const rejectedByReason = Object.entries(metricByLabel(parsed, 'hopr_packet_rejected_count', 'reason'));
  // the counter only gets series once something was rejected
  const rejected = rejectedByReason.length
    ? rejectedByReason.map(([reason, count]) => `${reason}: ${formatCount(count)}`).join(' · ')
    : parsed.hopr_packet_rejected_count
    ? '0'
    : '-';

  const mixerQueue = metricValue(parsed, 'hopr_mixer_queue_size');
  const mixerDelay = metricValue(parsed, 'hopr_mixer_average_packet_delay');
  const mixer =
    mixerQueue === null && mixerDelay === null
      ? '-'
      : `${mixerQueue ?? '-'} queued / ${mixerDelay !== null ? mixerDelay.toFixed(2) : '-'} ms avg delay`;

  const pathSum = metricValue(parsed, 'hopr_path_length', 'sum');
  const pathCount = metricValue(parsed, 'hopr_path_length', 'count');
  let pathLength = '-';
  if (pathSum !== null && pathCount) {
    // buckets are cumulative, so each hop count is the step from the previous bucket
    const buckets = Object.entries(metricByLabel(parsed, 'hopr_path_length', 'le'))
      .filter(([le]) => le !== '+Inf')
      .map(([le, cumulative]) => [Number(le), cumulative])
      .sort(([a], [b]) => a - b);
    const shares = buckets
      .map(([hops, cumulative], i) => [hops, (cumulative - (i > 0 ? buckets[i - 1][1] : 0)) / pathCount])
      .filter(([, share]) => share > 0)
      .map(([hops, share]) => `${hops}-hop ${Math.round(share * 100)}%`);
    pathLength = [`${(pathSum / pathCount).toFixed(2)} avg`, ...shares].join(' · ');
  }

  return (
    <TableExtended
      title="Transport"
      style={{ marginBottom: '42px' }}
    >
      <tbody>
        <tr>
          <th>
            <Tooltip
              title="NAT status as detected by libp2p autonat. Private means other nodes can not dial this node directly"
              notWide
            >
              <span>NAT status</span>
            </Tooltip>
          </th>
          <td>{natStatus !== null ? NAT_STATUS[natStatus] ?? natStatus : '-'}</td>
        </tr>
        <tr>
          <th>
            <Tooltip
              title="Currently active p2p connections"
              notWide
            >
              <span>P2P connections</span>
            </Tooltip>
          </th>
          <td>{connections !== null ? connections : '-'}</td>
        </tr>
        <tr>
          <th>
            <Tooltip
              title="Packet acknowledgements sent and received since the node started"
              notWide
            >
              <span>Acknowledgements</span>
            </Tooltip>
          </th>
          <td>{acks}</td>
        </tr>
        <tr>
          <th>
            <Tooltip
              title="Incoming packets rejected since the node started, by reason"
              notWide
            >
              <span>Rejected packets</span>
            </Tooltip>
          </th>
          <td>{rejected}</td>
        </tr>
        <tr>
          <th>
            <Tooltip
              title="Packets waiting in the mixer and the average delay the mixer adds to a packet"
              notWide
            >
              <span>Mixer</span>
            </Tooltip>
          </th>
          <td>{mixer}</td>
        </tr>
        <tr>
          <th>
            <Tooltip
              title="Number of hops of the messages this node sent - the average followed by the share of each hop count. 0-hop messages go to the destination directly"
              notWide
            >
              <span>Path length</span>
            </Tooltip>
          </th>
          <td>{pathLength}</td>
        </tr>
      </tbody>
    </TableExtended>
  );
}

export default Transport;
