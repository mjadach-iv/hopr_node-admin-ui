import { useAppSelector } from '../../../store';
import { formatCount, metricByLabel, metricValue } from '../../../utils/metrics';
import { Card, KV } from './ui';

const NAT_STATUS = ['Unknown', 'Public', 'Private'];

function Transport() {
  const parsed = useAppSelector((store) => store.node.metrics.data.parsed);

  const natStatus = metricValue(parsed, 'hopr_transport_p2p_nat_status');
  const connections = metricValue(parsed, 'hopr_transport_p2p_active_connection_count');

  const acksSent = metricValue(parsed, 'hopr_protocol_ack_sent_count');
  const acksReceived = metricByLabel(parsed, 'hopr_protocol_ack_received_count', 'valid');
  const acks =
    acksSent === null && acksReceived.true === undefined ? (
      '-'
    ) : (
      <>
        {formatCount(acksSent)} <span className="sub">sent</span> · {formatCount(acksReceived.true ?? null)}{' '}
        <span className="sub">recv</span>
        {acksReceived.false ? (
          <>
            {' '}
            · {formatCount(acksReceived.false)} <span className="sub">invalid</span>
          </>
        ) : null}
      </>
    );

  const rejectedByReason = Object.entries(metricByLabel(parsed, 'hopr_packet_rejected_count', 'reason'));
  // the counter only gets series once something was rejected
  const rejected = rejectedByReason.length
    ? rejectedByReason.map(([reason, count]) => `${reason.replace(/_/g, ' ')} ${formatCount(count)}`).join(' · ')
    : parsed.hopr_packet_rejected_count
    ? '0'
    : '-';

  const mixerQueue = metricValue(parsed, 'hopr_mixer_queue_size');
  const mixerDelay = metricValue(parsed, 'hopr_mixer_average_packet_delay');
  const mixer =
    mixerQueue === null && mixerDelay === null ? (
      '-'
    ) : (
      <>
        {mixerQueue ?? '-'} <span className="sub">queued</span> · {mixerDelay !== null ? mixerDelay.toFixed(1) : '-'}{' '}
        <span className="sub">ms delay</span>
      </>
    );

  const pathSum = metricValue(parsed, 'hopr_path_length', 'sum');
  const pathCount = metricValue(parsed, 'hopr_path_length', 'count');
  let pathLength = '-';
  let pathShares = '';
  if (pathSum !== null && pathCount) {
    // buckets are cumulative, so each hop count is the step from the previous bucket
    const buckets = Object.entries(metricByLabel(parsed, 'hopr_path_length', 'le'))
      .filter(([le]) => le !== '+Inf')
      .map(([le, cumulative]) => [Number(le), cumulative])
      .sort(([a], [b]) => a - b);
    pathShares = buckets
      .map(([hops, cumulative], i) => [hops, (cumulative - (i > 0 ? buckets[i - 1][1] : 0)) / pathCount])
      .filter(([, share]) => share > 0)
      // the metric's 0 bucket is shown as 1-hop
      .map(([hops, share]) => `${hops === 0 ? 1 : hops}-hop ${Math.round(share * 100)}%`)
      .join(' · ');
    pathLength = `${(pathSum / pathCount).toFixed(2)} avg`;
  }

  return (
    <Card title="Transport">
      <KV
        label="NAT status"
        tip="NAT status as detected by libp2p autonat. Private means other nodes can not dial this node directly"
      >
        {natStatus !== null ? NAT_STATUS[natStatus] ?? natStatus : '-'}
      </KV>
      <KV
        label="P2P connections"
        tip="Currently active p2p connections"
      >
        {connections !== null ? connections : '-'}
      </KV>
      <KV
        label="Acknowledgements"
        tip="Packet acknowledgements sent and received since the node started"
      >
        {acks}
      </KV>
      <KV
        label="Rejected"
        tip="Incoming packets rejected since the node started, by reason"
        title={rejected}
      >
        {rejected}
      </KV>
      <KV
        label="Mixer"
        tip="Packets waiting in the mixer and the average delay the mixer adds to a packet"
      >
        {mixer}
      </KV>
      <KV
        label="Path length"
        tip="Number of hops of the messages this node sent - the average followed by the share of each hop count. 1-hop messages go to the destination directly"
        title={pathShares}
      >
        {pathLength}
        {pathShares && <span className="sub">· {pathShares}</span>}
      </KV>
    </Card>
  );
}

export default Transport;
