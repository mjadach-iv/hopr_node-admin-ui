import { useAppDispatch, useAppSelector } from '../../store';
import { blokliActionsAsync } from '../../store/slices/blokli';
import { selectBlokliUrl } from '../../store/selectors/blokli';
import { fetchNetworkDashboardData } from '../../store/slices/networkDashboard/fetchNetworkDashboardData';
import { utils as dashboardUtils } from '../../networkDashboard';

// HOPR Components
import Section from '../../future-hopr-lib-components/Section';
import { SubpageTitle } from '../../components/SubpageTitle';
import TablePro from '../../future-hopr-lib-components/Table/table-pro';
import PeersInfo from '../../future-hopr-lib-components/PeerInfo';
import { LastSeen } from '../../components/LastSeen';
import ProgressBar from '../../future-hopr-lib-components/Progressbar';
import { TokenAmount } from '../../components/TokenAmount';
import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { WithUnit } from '../../components/Unit';

// Modals
import { PingModal } from '../../components/Modal/node/PingModal';
import { CreateAliasModal } from '../../components/Modal/node/AddAliasModal';
import { OpenChannelModal } from '../../components/Modal/node/OpenChannelModal';
import { FundChannelModal } from '../../components/Modal/node/FundChannelModal';
import { OpenSessionModal } from '../../components/Modal/node/OpenSessionModal';

// '30.0 Mbps' in the cell, the share of the tested speed on hover
const Throughput = ({ mbps, maxMbps }: { mbps?: number | null; maxMbps?: number | null }) => (
  <Tooltip title={typeof mbps === 'number' && maxMbps ? dashboardUtils.formatMbps(mbps, maxMbps) : ''}>
    <span>
      <WithUnit text={dashboardUtils.formatMbps(mbps)} />
    </span>
  </Tooltip>
);

/**
 * Nodes registered to the same safe as the connected node. All on-chain figures
 * come from blokli, missing ones render as '-' and are never filled in from node
 * data. Last seen is p2p liveness the chain cannot know, so it comes from the
 * connected node's peer data like on the aliases page. Availability and throughput
 * are what the network dashboard measured from the outside.
 */
function SafeNodesPage() {
  const dispatch = useAppDispatch();
  const safeNodes = useAppSelector((store) => store.blokli.safeNodes);
  const aliases = useAppSelector((store) => store.node.aliases);
  const peersObject = useAppSelector((store) => store.node.peersConnected.parsed.obj);
  const mypeerAddress = useAppSelector((store) => store.node.addresses.data.native);
  const hoprNodeSafe = useAppSelector((store) => store.node.info.data?.hoprNodeSafe);
  const peerAddressToOutgoingChannelLink = useAppSelector((store) => store.node.links.peerAddressToOutgoingChannel);
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const hoprNetworkName = useAppSelector((store) => store.node.info.data?.hoprNetworkName);
  const dashboardNodes = useAppSelector((store) => store.networkDashboard.nodes);

  const handleRefresh = () => {
    fetchNetworkDashboardData({
      networkName: hoprNetworkName,
      nodeAddress: mypeerAddress,
      safeNodeAddresses: (safeNodes.data ?? []).map((node) => node.nodeAddress),
      dispatch,
    });
    if (!blokliUrl || !mypeerAddress || !hoprNodeSafe) return;
    dispatch(
      blokliActionsAsync.getSafeNodesThunk({
        blokliUrl,
        nodeAddress: mypeerAddress,
        safeAddress: hoprNodeSafe,
      }),
    );
  };

  const parsedTableData = (safeNodes.data ?? []).map((safeNode, index) => {
    const nodeAddress = safeNode.nodeAddress;
    const stats = dashboardNodes.data?.byAddress[nodeAddress];
    return {
      id: nodeAddress,
      key: index.toString(),
      alias: aliases?.[nodeAddress] ?? '',
      node: (
        <PeersInfo
          peerAddress={nodeAddress}
          shortAddress
        />
      ),
      peerAddress: nodeAddress,
      xDai: (
        <TokenAmount
          value={safeNode.xDai?.formatted}
          unit="xDai"
        />
      ),
      channelsCount: safeNode.channels ? safeNode.channels.count : '-',
      channelsFunds: (
        <TokenAmount
          value={safeNode.channels?.formatted}
          unit="wxHOPR"
        />
      ),
      redeemed: (
        <TokenAmount
          value={safeNode.redeemed?.formatted}
          unit="wxHOPR"
        />
      ),
      availability24h: typeof stats?.availability24h === 'number' ? <ProgressBar value={stats.availability24h} /> : '-',
      lastThroughput: (
        <Throughput
          mbps={stats?.lastThroughput}
          maxMbps={stats?.maxLastThroughput}
        />
      ),
      throughput24h: (
        <Throughput
          mbps={stats?.throughput24h}
          maxMbps={stats?.maxThroughput24h}
        />
      ),
      lastSeen: (
        <LastSeen
          timestamp={peersObject[nodeAddress]?.lastUpdate ?? 0}
          self={nodeAddress === mypeerAddress}
        />
      ),
      actions: (
        <>
          <PingModal
            address={nodeAddress}
            disabled={nodeAddress === mypeerAddress}
            tooltip={nodeAddress === mypeerAddress ? `You can't ping yourself` : undefined}
          />
          <CreateAliasModal address={nodeAddress} />
          {peerAddressToOutgoingChannelLink[nodeAddress] ? (
            <FundChannelModal address={nodeAddress} />
          ) : (
            <OpenChannelModal
              peerAddress={nodeAddress}
              disabled={nodeAddress === mypeerAddress}
              tooltip={nodeAddress === mypeerAddress ? `You can't open a channel to yourself` : undefined}
            />
          )}
          <OpenSessionModal destination={nodeAddress} />
        </>
      ),
    };
  });

  const header = [
    {
      key: 'alias',
      name: 'Alias',
      search: true,
      hidden: true,
    },
    {
      key: 'node',
      name: 'Node',
      grow: true,
    },
    {
      key: 'peerAddress',
      name: 'Node Address',
      search: true,
      hidden: true,
    },
    {
      key: 'xDai',
      name: 'xDai',
      align: 'right' as const,
    },
    {
      key: 'channelsCount',
      name: 'Ch.',
      align: 'right' as const,
      tooltipHeader: 'Open outgoing channels of the node',
    },
    {
      key: 'channelsFunds',
      name: 'In channels',
      align: 'right' as const,
    },
    {
      key: 'redeemed',
      name: 'Earned',
      align: 'right' as const,
    },
    {
      key: 'availability24h',
      name: 'Avail. 24h',
      tooltipHeader: 'Share of the network dashboard pings answered in the last 24 hours',
    },
    {
      key: 'lastThroughput',
      name: 'Last tput',
      align: 'right' as const,
      tooltipHeader: `Relay throughput in the most recent hour the network dashboard tested the node. ${dashboardUtils.CT_ELIGIBILITY_HINT}`,
    },
    {
      key: 'throughput24h',
      name: 'Tput 24h',
      align: 'right' as const,
      tooltipHeader: `Average relay throughput measured by the network dashboard in the last 24 hours. ${dashboardUtils.CT_ELIGIBILITY_HINT}`,
    },
    {
      key: 'lastSeen',
      name: 'Last seen',
    },
    {
      key: 'actions',
      name: '',
      search: false,
    },
  ];

  return (
    <Section
      className="Section--safe-nodes"
      id="Section--safe-nodes"
      fullHeightMin
      yellow
    >
      <SubpageTitle
        title={safeNodes.data ? `NODES (${parsedTableData.length})` : 'NODES'}
        refreshFunction={handleRefresh}
        reloading={safeNodes.isFetching || dashboardNodes.isFetching}
      />
      <TablePro
        data={parsedTableData}
        id={'safe-nodes-table'}
        search={true}
        header={header}
        loading={safeNodes.data === null && safeNodes.isFetching}
        orderByDefault="peerAddress"
      />
    </Section>
  );
}

export default SafeNodesPage;
