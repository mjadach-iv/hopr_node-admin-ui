import { useMemo, useState } from 'react';
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

// Modals
import { PingModal } from '../Modal/node/PingModal';
import { CreateAliasModal } from '../Modal/node/AddAliasModal';
import { OpenChannelModal } from '../Modal/node/OpenChannelModal';
import { FundChannelModal } from '../Modal/node/FundChannelModal';
import { OpenSessionModal } from '../Modal/node/OpenSessionModal';

// Mui
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

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
    align: 'right' as const,
    tooltipHeader: 'Channel epoch, it goes up every time the channel is reopened. From blokli.',
  },
  {
    key: 'ticketIndex',
    name: 'Tickets',
    sortKey: 'ticketIndexValue',
    align: 'right' as const,
    tooltipHeader:
      'On-chain ticket index: the tickets issued in the current channel epoch up to its last on-chain redemption, winning and losing. From blokli.',
  },
  {
    key: 'estimate',
    name: direction === 'outgoing' ? 'Est. spent' : 'Est. earned',
    sortKey: 'estimateValue',
    align: 'right' as const,
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
  ticketIndexValue: channel?.ticketIndex,
  estimateValue: channel?.estimatedValue?.formatted,
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
        ≈ {shrinkNumber(channel.estimatedValue.formatted)}
        <span className="unit">{HOPR_TOKEN_USED}</span>
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

export const ClosedChannelsTable = ({
  direction,
  channels,
}: {
  direction: Direction;
  channels: BlokliChannelType[];
}) => {
  const aliases = useAppSelector((store) => store.node.aliases);
  const peerAddressToOutgoingChannelLink = useAppSelector((store) => store.node.links.peerAddressToOutgoingChannel);
  const [show, set_show] = useState(false);

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
      actions: address ? (
        <>
          <PingModal address={address} />
          <CreateAliasModal address={address} />
          {peerAddressToOutgoingChannelLink[address] ? (
            <FundChannelModal address={address} />
          ) : (
            <OpenChannelModal peerAddress={address} />
          )}
          <OpenSessionModal destination={address} />
        </>
      ) : (
        <></>
      ),
    };
  });

  const header = [
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
      key: 'channelId',
      name: 'Channel ID',
      search: true,
      copy: true,
      tooltip: true,
    },
    {
      key: 'epoch',
      name: 'Last epoch',
      align: 'right' as const,
    },
    {
      key: 'actions',
      name: '',
      search: false,
    },
  ];

  return (
    <>
      <SubpageTitle
        title={`CLOSED ${direction.toUpperCase()} CHANNELS (${channels.length})`}
        titleAction={
          <IconButton
            iconComponent={show ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            tooltipText={
              <span>
                {show ? 'HIDE' : 'SHOW'}
                <br />
                closed {direction} channels
              </span>
            }
            disabled={channels.length === 0}
            onClick={() => set_show(!show)}
          />
        }
      />
      {show && (
        <TablePro
          data={data}
          id={`node-channels-${direction === 'outgoing' ? 'out' : 'in'}-closed-table`}
          header={header}
          search
          orderByDefault="number"
        />
      )}
    </>
  );
};
