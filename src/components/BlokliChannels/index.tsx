import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { blokliActionsAsync } from '../../store/slices/blokli';
import { selectBlokliUrl } from '../../store/selectors/blokli';
import type { BlokliChannelType } from '../../blokli';
import { formatCount } from '../../utils/metrics';
import { shrinkNumber } from '../../utils/amount';
import { formatTimeToUserTimezone } from '../../utils/date';
import { HOPR_TOKEN_USED } from '../../../config';
import { loadStateFromLocalStorage, saveStateToLocalStorage } from '../../utils/localStorage';

// HOPR Components
import { SubpageTitle } from '../SubpageTitle';
import TablePro from '../../future-hopr-lib-components/Table/table-pro';
import PeersInfo from '../../future-hopr-lib-components/PeerInfo';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { StatusPill } from '../StatusPill';

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
  redeemedHeader(direction),
];

export const redeemedHeader = (direction: Direction) => ({
  key: 'redeemed',
  name: direction === 'outgoing' ? 'Spent' : 'Earned',
  sortKey: 'redeemedValue',
  align: 'right' as const,
  tooltipHeader: (
    <>
      {direction === 'outgoing' ? 'Redeemed by the counterparty' : 'Redeemed by this node'} from the channel over all
      its epochs, read from the on-chain TicketRedeemed events. Unredeemed tickets are not counted.
      <br />
      <br />
      Marked ≈ when the chain could not be read: then it is an estimate of the current epoch, its ticket index × the
      current ticket price for one hop.
    </>
  ),
});

const Amount = ({ value, approximate }: { value: string; approximate?: boolean }) => (
  <Tooltip title={`${value} ${HOPR_TOKEN_USED}`}>
    <span>
      {approximate && '≈ '}
      {shrinkNumber(value)}
      <span className="unit">{HOPR_TOKEN_USED}</span>
    </span>
  </Tooltip>
);

export const redeemedCells = (channel: BlokliChannelType | undefined) => {
  const exact = channel?.redeemed?.formatted;
  const estimate = channel?.estimatedValue?.formatted;
  return {
    redeemedValue: exact ?? estimate,
    redeemed: exact ? (
      <Amount value={exact} />
    ) : estimate ? (
      <Amount
        value={estimate}
        approximate
      />
    ) : (
      '-'
    ),
  };
};

export const blokliChannelCells = (channel: BlokliChannelType | undefined) => ({
  epoch: channel ? channel.epoch.toString() : '-',
  ticketIndexValue: channel?.ticketIndex,
  ticketIndex: channel ? (
    <Tooltip title={BigInt(channel.ticketIndex).toLocaleString('en-US')}>
      <span>{formatCount(channel.ticketIndex)}</span>
    </Tooltip>
  ) : (
    '-'
  ),
  ...redeemedCells(channel),
});

export const statusWithClosure = (status: string, channel: BlokliChannelType | undefined): string => {
  if (channel?.status !== 'PENDINGTOCLOSE' || !channel.closureTime) return status;
  const closable =
    new Date(channel.closureTime).getTime() < Date.now() ? 'now' : formatTimeToUserTimezone(channel.closureTime);
  return `${status} · closable ${closable}`;
};

// m:ss, h:mm:ss from an hour up
const formatCountdown = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
};

/** Status pill counting down to when a closing channel can be finalized, the exact time on hover. */
export const ChannelStatus = ({ status, channel }: { status: string; channel: BlokliChannelType | undefined }) => {
  const closureTime = channel?.status === 'PENDINGTOCLOSE' ? channel.closureTime : null;
  const closureMs = closureTime ? new Date(closureTime).getTime() : null;
  const [now, set_now] = useState(Date.now);
  const closable = closureMs !== null && closureMs <= now;

  useEffect(() => {
    if (closureMs === null || closable) return;
    const timer = setInterval(() => set_now(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [closureMs, closable]);

  if (!closureTime || closureMs === null) return <StatusPill status={status} />;
  return (
    <Tooltip title={`closable ${formatTimeToUserTimezone(closureTime)}`}>
      <span>
        <StatusPill
          status={`${status} · ${closable ? 'closable now' : `closable in ${formatCountdown(closureMs - now)}`}`}
        />
      </span>
    </Tooltip>
  );
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
  const showKey = `app/closedChannels/${direction}/show`;
  const [show, set_show] = useState(() => loadStateFromLocalStorage(showKey) === true);

  const toggleShow = () => {
    saveStateToLocalStorage(showKey, !show);
    set_show(!show);
  };

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
      ...redeemedCells(channel),
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
    redeemedHeader(direction),
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
            onClick={toggleShow}
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
