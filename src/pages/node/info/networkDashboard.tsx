import { useAppSelector } from '../../../store';
import { utils, api } from '../../../networkDashboard';
import { formatDate } from '../../../utils/date';
import { Card, KV, Stat, Stats } from './ui';
import { WithUnit } from '../../../components/Unit';

const { formatAvailability, formatLatency, formatMbps, CT_ELIGIBILITY_HINT } = utils;

const formatUtc = (ms: number) => `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')} UTC`;

/**
 * What the HOPR network dashboard measured about this node from the outside.
 */
function NetworkDashboard() {
  const networkName = useAppSelector((store) => store.node.info.data?.hoprNetworkName);
  const envId = useAppSelector((store) => store.networkDashboard.envId);
  const nodeAddress = useAppSelector((store) => store.networkDashboard.nodeAddress);
  const nodes = useAppSelector((store) => store.networkDashboard.nodes.data);
  const stats = nodeAddress ? nodes?.byAddress[nodeAddress] : undefined;

  const link = (
    <a
      href={api.NETWORK_DASHBOARD_URL}
      target="_blank"
      rel="noreferrer"
    >
      network.hoprnet.org ↗
    </a>
  );

  if (envId === null) {
    return (
      <Card
        title="Network dashboard"
        extra={link}
      >
        <KV
          label="Tracked"
          tip="Only networks listed on network.hoprnet.org have dashboard figures"
        >
          {`${networkName ?? '-'} is not tracked`}
        </KV>
      </Card>
    );
  }

  const measuredAt = stats?.lastMeasuredAt ? ` measured at ${formatUtc(stats.lastMeasuredAt)}` : '';

  return (
    <Card
      title="Network dashboard"
      extra={link}
    >
      <Stats>
        <Stat
          label="Availability 24h"
          value={formatAvailability(stats?.availability24h)}
          meter={stats?.availability24h}
          tip="Share of the dashboard's pings this node answered in the last 24 hours"
        />
        <Stat
          label="7d"
          value={formatAvailability(stats?.availability7d)}
          meter={stats?.availability7d}
          tip="Share of the dashboard's pings this node answered in the last 7 days"
        />
        <Stat
          label="30d"
          value={formatAvailability(stats?.availability30d)}
          meter={stats?.availability30d}
          tip="Share of the dashboard's pings this node answered in the last 30 days"
        />
      </Stats>
      <KV
        label="Latency"
        tip="Median latency of the dashboard's pings to this node in the last 24 hours"
      >
        <WithUnit text={formatLatency(stats?.latency)} />
      </KV>
      <KV
        label="First seen"
        tip="When the dashboard first saw this node on the network"
      >
        {stats?.firstSeen ? formatDate(stats.firstSeen, false) : '-'}
      </KV>
      <KV
        label="Throughput last / 24h"
        tip={`Relay throughput in the most recent hour the dashboard tested this node${measuredAt}, and the average during cover traffic bursts in the last 24 hours. ${CT_ELIGIBILITY_HINT}`}
      >
        <WithUnit text={formatMbps(stats?.lastThroughput)} /> / <WithUnit text={formatMbps(stats?.throughput24h)} />
      </KV>
    </Card>
  );
}

export default NetworkDashboard;
