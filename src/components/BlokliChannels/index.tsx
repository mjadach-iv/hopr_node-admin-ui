import { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { blokliActionsAsync } from '../../store/slices/blokli';
import { selectBlokliUrl } from '../../store/selectors/blokli';
import type { BlokliChannelType } from '../../blokli';
import { formatCount } from '../../utils/metrics';
import { shrinkNumber } from '../../utils/amount';
import { formatTimeToUserTimezone } from '../../utils/date';
import { HOPR_TOKEN_USED } from '../../../config';

// HOPR Components
import { SubpageTitle } from '../SubpageTitle';
import TablePro from '../../future-hopr-lib-components/Table/table-pro';
import PeersInfo from '../../future-hopr-lib-components/PeerInfo';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';

// Mui
import HistoryIcon from '@mui/icons-material/History';

type Direction = 'incoming' | 'outgoing';

/**
 * On-chain view of the connected node's channels in one direction, read from
 * blokli. byId is keyed like the hoprd channel ids lowercased.
 */
export const useBlokliChannels = (direction: Direction) => {
  const dispatch = useAppDispatch();
  const nodeChannels = useAppSelector((store) => store.blokli.nodeChannels);
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const nodeAddress = useAppSelector((store) => store.node.addresses.data.native);
  const channels = nodeChannels.data?.[direction];

  const byId = useMemo(
    () => Object.fromEntries((channels ?? []).map((channel) => [channel.channelId, channel])),
    [channels],
  );
  const closed = useMemo(() => (channels ?? []).filter((channel) => channel.status === 'CLOSED'), [channels]);

  const refresh = () => {
    if (!blokliUrl || !nodeAddress) return;
    dispatch(
      blokliActionsAsync.getNodeChannelsThunk({
        blokliUrl,
        nodeAddress,
      }),
    );
  };

  return {
    byId,
    closed,
    refresh,
  };
};

export const blokliChannelHeader = (direction: Direction) => [
  {
    key: 'epoch',
    name: 'Epoch',
    maxWidth: '45px',
    tooltipHeader: 'Channel epoch, it goes up every time the channel is reopened. From blokli.',
  },
  {
    key: 'ticketIndex',
    name: 'Tickets',
    maxWidth: '60px',
    tooltipHeader:
      'On-chain ticket index: the tickets issued in the current channel epoch up to its last on-chain redemption, winning and losing. From blokli.',
  },
  {
    key: 'estimate',
    name: direction === 'outgoing' ? 'Est. spent' : 'Est. earned',
    maxWidth: '90px',
    tooltipHeader: (
      <>
        Estimate: tickets issued in the current channel epoch up to its last on-chain redemption × current ticket price
        for one hop.
        <br />
        <br />
        Multi-hop tickets are worth more and unredeemed tickets are not counted. Resets when the channel closes. From
        blokli.
      </>
    ),
  },
];

export const blokliChannelCells = (channel: BlokliChannelType | undefined) => ({
  epoch: channel ? channel.epoch.toString() : '-',
  ticketIndex: channel ? (
    <Tooltip title={BigInt(channel.ticketIndex).toLocaleString('en-US')}>
      <span>{formatCount(channel.ticketIndex)}</span>
    </Tooltip>
  ) : (
    '-'
  ),
  estimate: channel?.estimatedValue ? (
    <Tooltip title={`${channel.estimatedValue.formatted} ${HOPR_TOKEN_USED}`}>
      <span>
        ≈ {shrinkNumber(channel.estimatedValue.formatted)} {HOPR_TOKEN_USED}
      </span>
    </Tooltip>
  ) : (
    '-'
  ),
});

export const statusWithClosure = (status: string, channel: BlokliChannelType | undefined): string => {
  if (channel?.status !== 'PENDINGTOCLOSE' || !channel.closureTime) return status;
  const closable =
    new Date(channel.closureTime).getTime() < Date.now() ? 'now' : formatTimeToUserTimezone(channel.closureTime);
  return `${status} · closable ${closable}`;
};

export const ClosedChannelsButton = ({
  direction,
  count,
  show,
  onClick,
}: {
  direction: Direction;
  count: number;
  show: boolean;
  onClick: () => void;
}) => (
  <IconButton
    iconComponent={<HistoryIcon />}
    tooltipText={
      <span>
        {show ? 'HIDE' : 'SHOW'}
        <br />
        closed {direction} channels ({count})
      </span>
    }
    disabled={count === 0}
    onClick={onClick}
  />
);

export const ClosedChannelsTable = ({
  direction,
  channels,
}: {
  direction: Direction;
  channels: BlokliChannelType[];
}) => {
  const aliases = useAppSelector((store) => store.node.aliases);

  const data = channels.map((channel, index) => {
    const address = channel.counterparty;
    return {
      id: (index + 1).toString(),
      key: channel.channelId,
      node: address ? (
        <PeersInfo
          peerAddress={address}
          shortAddress
        />
      ) : (
        '-'
      ),
      peerAddress: address ? (aliases?.[address] ? `${aliases[address]} (${address})` : address) : '',
      channelId: channel.channelId,
      epoch: channel.epoch.toString(),
      actions: <></>,
    };
  });

  const header = [
    {
      key: 'id',
      name: '#',
    },
    {
      key: 'node',
      name: 'Node',
      maxWidth: '500px',
    },
    {
      key: 'peerAddress',
      name: 'Node Address',
      search: true,
      hidden: true,
    },
    {
      key: 'channelId',
      name: 'Channel ID',
      search: true,
      copy: true,
      tooltip: true,
      maxWidth: '200px',
    },
    {
      key: 'epoch',
      name: 'Last epoch',
      maxWidth: '60px',
    },
  ];

  return (
    <>
      <SubpageTitle title={`CLOSED ${direction.toUpperCase()} CHANNELS (${channels.length})`} />
      <TablePro
        data={data}
        id={`node-channels-${direction === 'outgoing' ? 'out' : 'in'}-closed-table`}
        header={header}
        search
        orderByDefault="number"
      />
    </>
  );
};
