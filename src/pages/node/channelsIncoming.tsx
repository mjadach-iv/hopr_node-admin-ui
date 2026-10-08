import { useEffect, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { actionsAsync } from '../../store/slices/node/actionsAsync';
import { useNavigate } from 'react-router-dom';
import { exportToCsv } from '../../utils/helpers';
import { HOPR_TOKEN_USED } from '../../../config';
import { sendNotification } from '../../hooks/useWatcher/notifications';
import { formatEther } from 'viem';
import { utils as hoprdUtils } from '@hoprnet/hopr-sdk';
const { sdkApiError } = hoprdUtils;

// HOPR Components
import Section from '../../future-hopr-lib-components/Section';
import { SubpageTitle } from '../../components/SubpageTitle';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import TablePro from '../../future-hopr-lib-components/Table/table-pro';
import CloseChannelIcon from '../../future-hopr-lib-components/Icons/CloseChannel';
import PeersInfo from '../../future-hopr-lib-components/PeerInfo';
import { TokenAmount } from '../../components/TokenAmount';
import { StatusPill } from '../../components/StatusPill';
import {
  useBlokliChannels,
  blokliChannelHeader,
  blokliChannelCells,
  statusWithClosure,
  ClosedChannelsButton,
  ClosedChannelsTable,
} from '../../components/BlokliChannels';

// Modals
import { PingModal } from '../../components/Modal/node/PingModal';
import { OpenChannelModal } from '../../components/Modal/node/OpenChannelModal';
import { FundChannelModal } from '../../components/Modal/node/FundChannelModal';
import { CreateAliasModal } from '../../components/Modal/node//AddAliasModal';
import { OpenSessionModal } from '../../components/Modal/node/OpenSessionModal';
import { ChannelTicketStatisticsModal } from '../../components/Modal/node/ChannelTicketStatisticsModal';
//import { SendMessageModal } from '../../components/Modal/node/SendMessageModal.tsx_';

// Mui
import GetAppIcon from '@mui/icons-material/GetApp';

function ChannelsPage() {
  const dispatch = useAppDispatch();
  const channels = useAppSelector((store) => store.node.channels.data);
  const channelsIncoming = useAppSelector((store) => store.node.channels.data?.incoming);
  const channelsIncomingObject = useAppSelector((store) => store.node.channels.parsed.incoming);
  const channelsFetching = useAppSelector((store) => store.node.channels.isFetching);
  const aliases = useAppSelector((store) => store.node.aliases);
  const currentApiEndpoint = useAppSelector((store) => store.node.apiEndpoint);
  const loginData = useAppSelector((store) => store.auth.loginData);
  const peerAddressToOutgoingChannelLink = useAppSelector((store) => store.node.links.peerAddressToOutgoingChannel);
  const tickets = useAppSelector((store) => store.node.metricsParsed.tickets.incoming);
  const tabLabel = 'incoming';
  const channelsData = channels?.incoming;
  const blokliChannels = useBlokliChannels(tabLabel);
  const [showClosed, set_showClosed] = useState(false);

  const handleRefresh = () => {
    blokliChannels.refresh();
    if (!loginData.apiEndpoint) return;

    dispatch(
      actionsAsync.getChannelsThunk({
        apiEndpoint: loginData.apiEndpoint!,
        apiToken: loginData.apiToken ? loginData.apiToken : '',
      }),
    );
    dispatch(
      actionsAsync.getConnectedPeersThunk({
        apiEndpoint: loginData.apiEndpoint!,
        apiToken: loginData.apiToken ? loginData.apiToken : '',
      }),
    );
    dispatch(
      actionsAsync.getAnnouncedPeersThunk({
        apiEndpoint: loginData.apiEndpoint!,
        apiToken: loginData.apiToken ? loginData.apiToken : '',
      }),
    );
  };

  const getAliasByPeerAddress = (address: string): string => {
    if (aliases && address && aliases[address]) return `${aliases[address]} (${address})`;
    return address;
  };

  const handleExport = () => {
    if (channelsData) {
      exportToCsv(
        Object.entries(channelsData).map(([, channel]) => {
          const blokliChannel = blokliChannels.byId[channel.id.toLowerCase()];
          return {
            channelId: channel.id,
            peerAddress: channel.peerAddress,
            status: channel.status,
            dedicatedFunds: channel.balance,
            epoch: blokliChannel?.epoch ?? '',
            ticketIndex: blokliChannel?.ticketIndex ?? '',
            estimatedEarned: blokliChannel?.estimatedValue?.formatted ?? '',
          };
        }),
        `${tabLabel}-channels.csv`,
      );
    }
  };

  const headerIncoming = [
    {
      key: 'node',
      name: 'Node',
      grow: true,
    },
    {
      key: 'peerAddress',
      name: 'Node Address',
      search: true,
      copy: true,
      hidden: true,
    },
    {
      key: 'statusText',
      name: 'Status',
      search: true,
      hidden: true,
    },
    {
      key: 'status',
      name: 'Status',
    },
    {
      key: 'funds',
      name: 'Funds',
      align: 'right' as const,
    },
    ...blokliChannelHeader(tabLabel),
    // {
    //   key: 'tickets',
    //   name: 'Unredeemed',
    //   maxWidth: '130px',
    //   tooltipHeader: (
    //     <>
    //       Unredeemed value of tickets per channel in wxHOPR.
    //       <br />
    //       <br />
    //       Value is reset on node restart.
    //     </>
    //   ),
    //   tooltip: true,
    // },
    {
      key: 'actions',
      name: '',
      search: false,
    },
  ];

  const handleCloseChannel = (address: string) => {
    dispatch(
      actionsAsync.closeChannelThunk({
        apiEndpoint: loginData.apiEndpoint!,
        apiToken: loginData.apiToken ? loginData.apiToken : '',
        direction: 'incoming',
        address: address,
        timeout: 120_000, //TODO: put those values as default to HOPRd SDK, average is 50s
      }),
    )
      .unwrap()
      .then(() => {
        handleRefresh();
      })
      .catch(async (e) => {
        const isCurrentApiEndpointTheSame = await dispatch(
          actionsAsync.isCurrentApiEndpointTheSame(loginData.apiEndpoint!),
        ).unwrap();
        if (!isCurrentApiEndpointTheSame) return;

        let errMsg = `Closing of incoming channel from ${address} failed`;
        if (e instanceof sdkApiError && e.hoprdErrorPayload?.status)
          errMsg = errMsg + `.\n${e.hoprdErrorPayload.status}`;
        if (e instanceof sdkApiError && e.hoprdErrorPayload?.error) errMsg = errMsg + `.\n${e.hoprdErrorPayload.error}`;
        console.error(errMsg, e);
        sendNotification({
          notificationPayload: {
            source: 'node',
            name: errMsg,
            url: null,
            timeout: null,
          },
          toastPayload: { message: errMsg },
          dispatch,
        });
      });
  };

  const peersWithAliases = (channelsIncoming || []).filter(
    (peer) => aliases && peer.peerAddress && getAliasByPeerAddress(peer.peerAddress) !== peer.peerAddress,
  );
  const peersWithAliasesSorted = peersWithAliases.sort((a, b) => {
    if (getAliasByPeerAddress(b.peerAddress).toLowerCase() > getAliasByPeerAddress(a.peerAddress).toLowerCase()) {
      return -1;
    }
    if (getAliasByPeerAddress(b.peerAddress).toLowerCase() < getAliasByPeerAddress(a.peerAddress).toLowerCase()) {
      return 1;
    }
    return 0;
  });
  const peersWithoutAliases = (channelsIncoming || []).filter(
    (peer) => aliases && peer.peerAddress && getAliasByPeerAddress(peer.peerAddress) === peer.peerAddress,
  );
  const peersWithoutAliasesSorted = peersWithoutAliases.sort((a, b) => {
    if (b.peerAddress > a.peerAddress) {
      return -1;
    }
    if (b.peerAddress < a.peerAddress) {
      return 1;
    }
    return 0;
  });

  const peersSorted = [...peersWithAliasesSorted, ...peersWithoutAliasesSorted];

  const parsedTableData = peersSorted
    .map((channel, index) => {
      const id = channel.id;
      if (
        !channelsIncomingObject[id].peerAddress ||
        !channelsIncomingObject[id].balance ||
        !channelsIncomingObject[id].status
      )
        return;
      const outgoingChannelOpened = !!(
        channelsIncomingObject[id].peerAddress &&
        !!peerAddressToOutgoingChannelLink[channelsIncomingObject[id].peerAddress as string]
      );
      const peerAddress = channelsIncomingObject[id].peerAddress;
      const blokliChannel = blokliChannels.byId[id.toLowerCase()];

      const totalTicketsPerChannel = `${formatEther(
        BigInt(tickets?.redeemed[id]?.value || '0') + BigInt(tickets?.unredeemed[id]?.value || '0'),
      )}`;
      const unredeemedTicketsPerChannel = `${formatEther(BigInt(tickets?.unredeemed[id]?.value || '0'))}`;
      const ticketsPerChannel = `${formatEther(BigInt(tickets?.redeemed[id]?.value || '0'))}/${totalTicketsPerChannel}`;

      return {
        id: (index + 1).toString(),
        key: id,
        node: (
          <PeersInfo
            peerAddress={peerAddress}
            shortAddress
          />
        ),
        peerAddress: getAliasByPeerAddress(peerAddress as string),
        statusText: statusWithClosure(channelsIncomingObject[id].status as string, blokliChannel),
        status: <StatusPill status={statusWithClosure(channelsIncomingObject[id].status as string, blokliChannel)} />,
        funds: (
          <TokenAmount
            value={channelsIncomingObject[id].balance}
            unit={HOPR_TOKEN_USED}
          />
        ),
        ...blokliChannelCells(blokliChannel),
        tickets: unredeemedTicketsPerChannel,
        actions: (
          <>
            <PingModal
              address={peerAddress}
              disabled={!peerAddress}
              tooltip={
                !peerAddress ? (
                  <span>
                    DISABLED
                    <br />
                    Unable to find
                    <br />
                    node address
                  </span>
                ) : undefined
              }
            />
            <CreateAliasModal address={peerAddress} />
            {outgoingChannelOpened ? (
              <FundChannelModal address={peerAddress} />
            ) : (
              <OpenChannelModal peerAddress={peerAddress} />
            )}
            <IconButton
              iconComponent={<CloseChannelIcon />}
              pending={channelsIncomingObject[id]?.isClosing}
              tooltipText={
                <span>
                  CLOSE
                  <br />
                  incoming channel
                </span>
              }
              onClick={() => handleCloseChannel(id)}
            />
            <OpenSessionModal destination={peerAddress} />
            <ChannelTicketStatisticsModal address={peerAddress} />
            {/* <SendMessageModal
              peerAddress={peerAddress}
              disabled={!peerAddress}
              tooltip={
                !peerAddress ? (
                  <span>
                    DISABLED
                    <br />
                    Unable to find
                    <br />
                    peerAddress
                  </span>
                ) : undefined
              }
            /> */}
          </>
        ),
      };
    })
    .filter((elem) => elem !== undefined) as {
    id: string;
    key: string;
    peerAddress: string;
    status: JSX.Element;
    statusText: string;
    tickets: string;
    funds: JSX.Element;
    epoch: string;
    ticketIndex: string | JSX.Element;
    estimate: string | JSX.Element;
    actions: JSX.Element;
  }[];

  return (
    <Section
      className="Channels--aliases"
      id="Channels--aliases"
      fullHeightMin
      yellow
    >
      <SubpageTitle
        title={`INCOMING CHANNELS (${channelsData ? channelsData.length : '-'})`}
        refreshFunction={handleRefresh}
        reloading={channelsFetching}
        actions={
          <>
            <ClosedChannelsButton
              direction={tabLabel}
              count={blokliChannels.closed.length}
              show={showClosed}
              onClick={() => set_showClosed(!showClosed)}
            />
            <IconButton
              iconComponent={<GetAppIcon />}
              tooltipText={
                <span>
                  EXPORT
                  <br />
                  {tabLabel} channels as a CSV
                </span>
              }
              disabled={!channelsData || Object.keys(channelsData).length === 0}
              onClick={handleExport}
            />
          </>
        }
      />
      <TablePro
        data={parsedTableData}
        id={'node-channels-in-table'}
        header={headerIncoming}
        search
        loading={parsedTableData.length === 0 && channelsFetching}
        orderByDefault="number"
      />
      {showClosed && (
        <ClosedChannelsTable
          direction={tabLabel}
          channels={blokliChannels.closed}
        />
      )}
    </Section>
  );
}

export default ChannelsPage;
