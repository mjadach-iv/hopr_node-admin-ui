import { useAppSelector } from '../../../store';
import { TableExtended } from '../../../future-hopr-lib-components/Table/columed-data';
import Tooltip from '../../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { utils, api } from '../../../networkDashboard';
import { formatDate } from '../../../utils/date';

const { formatAvailability, formatLatency, formatMbps, CT_ELIGIBILITY_HINT } = utils;

const formatUtc = (ms: number) => `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')} UTC`;

function Row(props: { tooltip: string; title: string; value: React.ReactNode }) {
  return (
    <tr>
      <th>
        <Tooltip
          title={props.tooltip}
          notWide
        >
          <span>{props.title}</span>
        </Tooltip>
      </th>
      <td>{props.value}</td>
    </tr>
  );
}

/**
 * What the HOPR network dashboard measured about this node from the outside.
 */
function NetworkDashboard() {
  const networkName = useAppSelector((store) => store.node.info.data?.hoprNetworkName);
  const envId = useAppSelector((store) => store.networkDashboard.envId);
  const nodeAddress = useAppSelector((store) => store.networkDashboard.nodeAddress);
  const nodes = useAppSelector((store) => store.networkDashboard.nodes.data);
  const stats = nodeAddress ? nodes?.byAddress[nodeAddress] : undefined;

  const title = (
    <a
      href={api.NETWORK_DASHBOARD_URL}
      target="_blank"
      rel="noreferrer"
      style={{ color: 'inherit' }}
    >
      Network dashboard
    </a>
  );

  if (envId === null) {
    return (
      <TableExtended
        title={title}
        style={{ marginBottom: '42px' }}
      >
        <tbody>
          <Row
            tooltip="Only networks listed on network.hoprnet.org have dashboard figures"
            title="Tracked"
            value={`Network ${networkName ?? '-'} is not tracked by the network dashboard`}
          />
        </tbody>
      </TableExtended>
    );
  }

  const measuredAt = stats?.lastMeasuredAt ? ` measured at ${formatUtc(stats.lastMeasuredAt)}` : '';

  return (
    <TableExtended
      title={title}
      style={{ marginBottom: '42px' }}
    >
      <tbody>
        <Row
          tooltip="Share of the dashboard's pings this node answered in the last 24 hours"
          title="Availability 24h"
          value={formatAvailability(stats?.availability24h)}
        />
        <Row
          tooltip="Share of the dashboard's pings this node answered in the last 7 days"
          title="Availability 7d"
          value={formatAvailability(stats?.availability7d)}
        />
        <Row
          tooltip="Share of the dashboard's pings this node answered in the last 30 days"
          title="Availability 30d"
          value={formatAvailability(stats?.availability30d)}
        />
        <Row
          tooltip="Median latency of the dashboard's pings to this node in the last 24 hours"
          title="Latency"
          value={formatLatency(stats?.latency)}
        />
        <Row
          tooltip="When the dashboard first saw this node on the network"
          title="First seen"
          value={stats?.firstSeen ? formatDate(stats.firstSeen, false) : '-'}
        />
        <Row
          tooltip="When the dashboard last reached this node"
          title="Last seen"
          value={stats?.lastSeen ? formatDate(stats.lastSeen, false) : '-'}
        />
        <Row
          tooltip="Version of this node as seen by the dashboard"
          title="Version"
          value={stats?.version ?? '-'}
        />
        <Row
          tooltip={`Relay throughput in the most recent hour the dashboard tested this node${measuredAt}. ${CT_ELIGIBILITY_HINT}`}
          title="Last throughput"
          value={formatMbps(stats?.lastThroughput, stats?.maxLastThroughput)}
        />
        <Row
          tooltip={`Average relay throughput during cover traffic bursts in the last 24 hours. ${CT_ELIGIBILITY_HINT}`}
          title="24h avg. throughput"
          value={formatMbps(stats?.throughput24h, stats?.maxThroughput24h)}
        />
        <Row
          tooltip="End of the dashboard run these figures come from"
          title="Data as of"
          value={nodes?.lastRun ? formatDate(nodes.lastRun, false) : '-'}
        />
      </tbody>
    </TableExtended>
  );
}

export default NetworkDashboard;
