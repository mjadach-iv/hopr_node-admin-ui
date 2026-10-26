import type { JSX } from 'react';
import { formatEther } from 'viem';
import { useAppDispatch, useAppSelector } from '../../store';
import { appActions } from '../../store/slices/app';
import { sumSafeNodes } from '../../store/selectors/blokli';
import type { SafeNodeType } from '../../blokli';
import { utils as dashboardUtils, type NodesStatsType } from '../../networkDashboard';

// HOPR Components
import TablePro from '../../future-hopr-lib-components/Table/table-pro';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import PeersInfo from '../../future-hopr-lib-components/PeerInfo';
import { LastSeen } from '../LastSeen';
import ProgressBar from '../../future-hopr-lib-components/Progressbar';
import { TokenAmount } from '../TokenAmount';
import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { WithUnit } from '../Unit';

// Modals
import { PingModal } from '../Modal/node/PingModal';
import { CreateAliasModal } from '../Modal/node/AddAliasModal';
import { OpenChannelModal } from '../Modal/node/OpenChannelModal';
import { FundChannelModal } from '../Modal/node/FundChannelModal';
import { OpenSessionModal } from '../Modal/node/OpenSessionModal';

// Mui
import MuiCheckbox from '@mui/material/Checkbox';
import DeleteIcon from '@mui/icons-material/Delete';
import WatchedCheckboxIcon from '../../future-hopr-lib-components/Icons/WatchedCheckbox';

// '30.0 Mbps' in the cell, the share of the tested speed on hover
const Throughput = ({ mbps, maxMbps }: { mbps?: number | null; maxMbps?: number | null }) => (
  <Tooltip title={typeof mbps === 'number' && maxMbps ? dashboardUtils.formatMbps(mbps, maxMbps) : ''}>
    <span>
      <WithUnit text={dashboardUtils.formatMbps(mbps)} />
    </span>
  </Tooltip>
);

// a checkbox ticked with an eye, unticking stops watching the node
export const WatchCheckbox = ({ address, watched }: { address: string; watched: boolean }) => {
  const dispatch = useAppDispatch();
  const label = watched ? 'Remove from the watchlist' : 'Add to the watchlist';
  return (
    <Tooltip
      title={label}
      notWide
    >
      <span>
        <MuiCheckbox
          size="small"
          checked={watched}
          checkedIcon={<WatchedCheckboxIcon />}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => dispatch(appActions.setWatched({ address, watched: event.target.checked }))}
          inputProps={{ 'aria-label': label }}
          sx={{ p: '2px', color: 'var(--muted)', '&.Mui-checked': { color: 'var(--primary)' } }}
        />
      </span>
    </Tooltip>
  );
};

// in the watch column header: ticked when every node is watched, a click watches all or, when all are, none
const WatchAllCheckbox = ({ addresses, watched }: { addresses: string[]; watched: Set<string> }) => {
  const dispatch = useAppDispatch();
  const watchedCount = addresses.filter((address) => watched.has(address)).length;
  const all = addresses.length > 0 && watchedCount === addresses.length;
  const label = all ? 'Remove all from the watchlist' : 'Add all to the watchlist';
  return (
    <Tooltip
      title={label}
      notWide
    >
      <span>
        <MuiCheckbox
          size="small"
          checked={all}
          indeterminate={watchedCount > 0 && !all}
          disabled={addresses.length === 0}
          checkedIcon={<WatchedCheckboxIcon />}
          onChange={() => dispatch(appActions.setWatchedMany(Object.fromEntries(addresses.map((a) => [a, !all]))))}
          inputProps={{ 'aria-label': label }}
          sx={{
            p: '2px',
            color: 'var(--muted)',
            '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: 'var(--primary)' },
          }}
        />
      </span>
    </Tooltip>
  );
};

const toFormatted = (value: bigint | null) => (value === null ? null : formatEther(value));

type NodesTableProps = {
  id: string;
  nodes: SafeNodeType[];
  stats: NodesStatsType | null | undefined;
  loading?: boolean;
  // the watchlist: alias and a trash icon are the only actions, no watch checkbox
  removable?: boolean;
  // the group of each node, each group gets a header row with sums
  groupOf?: (nodeAddress: string) => string;
  // the start of a group's header row, what goes in its Balance and actions columns and
  // the nodes its sums cover: the rows the search left when missing, '-' sums when null
  renderGroupHeader?: (
    groupId: string,
    rowCount: number,
  ) => { label: JSX.Element; balance?: JSX.Element; actions?: JSX.Element; sumOver?: SafeNodeType[] | null };
};

/**
 * Table of nodes with their on-chain figures from blokli, missing ones render as
 * '-' and are never filled in from node data. Availability and throughput are
 * what the network dashboard measured from the outside. Last seen is p2p liveness
 * the chain cannot know: the connected node's peer data, without one the dashboard's.
 */
export const NodesTable = (props: NodesTableProps) => {
  const dispatch = useAppDispatch();
  const aliases = useAppSelector((store) => store.app.aliases);
  const watchlist = useAppSelector((store) => store.app.watchlist);
  const connected = useAppSelector((store) => store.auth.status.connected);
  const peersObject = useAppSelector((store) => store.node.peersConnected.parsed.obj);
  const mypeerAddress = useAppSelector((store) => store.node.addresses.data.native);
  const peerAddressToOutgoingChannelLink = useAppSelector((store) => store.node.links.peerAddressToOutgoingChannel);
  const watched = new Set(watchlist);
  const nodesByAddress = new Map(props.nodes.map((node) => [node.nodeAddress, node]));

  const parsedTableData = props.nodes.map((node, index) => {
    const nodeAddress = node.nodeAddress;
    const stats = props.stats?.byAddress[nodeAddress];
    const lastSeen = connected ? peersObject[nodeAddress]?.lastUpdate : stats?.lastSeen;
    const net =
      node.redeemed && node.spent ? formatEther(BigInt(node.redeemed.value) - BigInt(node.spent.value)) : null;
    return {
      id: nodeAddress,
      key: index.toString(),
      group: props.groupOf?.(nodeAddress),
      alias: aliases?.[nodeAddress] ?? '',
      watch: (
        <WatchCheckbox
          address={nodeAddress}
          watched={watched.has(nodeAddress)}
        />
      ),
      node: (
        <PeersInfo
          peerAddress={nodeAddress}
          shortAddress
        />
      ),
      peerAddress: nodeAddress,
      xDai: (
        <TokenAmount
          value={node.xDai?.formatted}
          unit="xDai"
        />
      ),
      channelsCount: node.channels ? node.channels.count : '-',
      channelsFunds: (
        <TokenAmount
          value={node.channels?.formatted}
          unit="wxHOPR"
        />
      ),
      net: (
        <TokenAmount
          value={net}
          unit="wxHOPR"
          broken={node.rpcBroken}
          signed
        />
      ),
      netValue: net,
      redeemed: (
        <TokenAmount
          value={node.redeemed?.formatted}
          unit="wxHOPR"
        />
      ),
      spent: (
        <TokenAmount
          value={node.spent?.formatted}
          unit="wxHOPR"
          broken={node.rpcBroken}
        />
      ),
      spentValue: node.spent?.formatted,
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
      xDaiValue: node.xDai?.formatted,
      channelsFundsValue: node.channels?.formatted,
      redeemedValue: node.redeemed?.formatted,
      availability24hValue: stats?.availability24h,
      lastThroughputValue: stats?.lastThroughput,
      throughput24hValue: stats?.throughput24h,
      lastSeenValue: lastSeen || null,
      lastSeen: (
        <LastSeen
          timestamp={lastSeen ?? 0}
          self={connected && nodeAddress === mypeerAddress}
        />
      ),
      actions: props.removable ? (
        <>
          <CreateAliasModal address={nodeAddress} />
          <IconButton
            iconComponent={<DeleteIcon />}
            tooltipText={
              <span>
                REMOVE
                <br />
                from the watchlist
              </span>
            }
            onClick={() => dispatch(appActions.setWatched({ address: nodeAddress, watched: false }))}
          />
        </>
      ) : (
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

  // '-' as soon as one node's figure is missing
  const groupHeader = (groupId: string, rows: { id: string | number }[]) => {
    const rowNodes = rows
      .map((row) => nodesByAddress.get(String(row.id)))
      .filter((node): node is SafeNodeType => !!node);
    const header = props.renderGroupHeader?.(groupId, rowNodes.length);
    const nodes = header?.sumOver === undefined ? rowNodes : header.sumOver;
    const earned = sumSafeNodes(nodes, 'redeemed');
    const spent = sumSafeNodes(nodes, 'spent');
    const net = earned !== null && spent !== null ? earned - spent : null;
    const rpcBroken = spent === null && !!nodes?.some((node) => node.rpcBroken);
    return {
      node: header?.label ?? groupId,
      xDai: header?.balance,
      channelsFunds: (
        <TokenAmount
          value={toFormatted(sumSafeNodes(nodes, 'channels'))}
          unit="wxHOPR"
        />
      ),
      net: (
        <TokenAmount
          value={toFormatted(net)}
          unit="wxHOPR"
          broken={rpcBroken}
          signed
        />
      ),
      redeemed: (
        <TokenAmount
          value={toFormatted(earned)}
          unit="wxHOPR"
        />
      ),
      spent: (
        <TokenAmount
          value={toFormatted(spent)}
          unit="wxHOPR"
          broken={rpcBroken}
        />
      ),
      actions: header?.actions,
    };
  };

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
      sortKey: 'peerAddress',
    },
    {
      key: 'peerAddress',
      name: 'Node Address',
      search: true,
      hidden: true,
    },
    {
      key: 'xDai',
      name: 'Balance',
      sortKey: 'xDaiValue',
      align: 'right' as const,
      tooltipHeader: props.renderGroupHeader
        ? 'xDai of each node. For a safe: wxHOPR in the safe / in total, with the channels of all its nodes'
        : 'xDai of the node, used to pay for transactions',
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
      sortKey: 'channelsFundsValue',
      align: 'right' as const,
    },
    {
      key: 'net',
      name: 'Net',
      sortKey: 'netValue',
      align: 'right' as const,
      tooltipHeader: 'Earned - spent',
    },
    {
      key: 'redeemed',
      name: 'Earned',
      sortKey: 'redeemedValue',
      align: 'right' as const,
      defaultHidden: true,
    },
    {
      key: 'spent',
      name: 'Spent',
      sortKey: 'spentValue',
      align: 'right' as const,
      defaultHidden: true,
      tooltipHeader: 'Redeemed by the counterparties from every channel the node opened, closed ones included',
    },
    {
      key: 'availability24h',
      name: 'Avail. 24h',
      sortKey: 'availability24hValue',
      tooltipHeader: 'Share of the network dashboard pings answered in the last 24 hours',
    },
    {
      key: 'lastThroughput',
      name: 'Last tput',
      sortKey: 'lastThroughputValue',
      align: 'right' as const,
      tooltipHeader: `Relay throughput in the most recent hour the network dashboard tested the node. ${dashboardUtils.CT_ELIGIBILITY_HINT}`,
    },
    {
      key: 'throughput24h',
      name: 'Tput 24h',
      sortKey: 'throughput24hValue',
      align: 'right' as const,
      tooltipHeader: `Average relay throughput measured by the network dashboard in the last 24 hours. ${dashboardUtils.CT_ELIGIBILITY_HINT}`,
    },
    {
      key: 'lastSeen',
      name: 'Last seen',
      sortKey: 'lastSeenValue',
      tooltipHeader: connected
        ? 'When the connected node last heard from the node'
        : 'When the network dashboard last reached the node',
    },
    {
      key: 'actions',
      name: '',
      search: false,
    },
    {
      key: 'watch',
      name: '',
      sortable: false,
      align: 'center' as const,
      hidden: props.removable,
      headerContent: (
        <WatchAllCheckbox
          addresses={props.nodes.map((node) => node.nodeAddress)}
          watched={watched}
        />
      ),
    },
  ];

  return (
    <TablePro
      data={parsedTableData}
      id={props.id}
      search={true}
      columnSelector
      header={header}
      loading={props.loading}
      orderByDefault="peerAddress"
      groupBy={props.groupOf ? 'group' : undefined}
      groupHeader={props.groupOf ? groupHeader : undefined}
    />
  );
};
