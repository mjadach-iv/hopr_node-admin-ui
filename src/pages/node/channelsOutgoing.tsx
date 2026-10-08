import { useEffect, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { actionsAsync } from '../../store/slices/node/actionsAsync';
import { useNavigate } from 'react-router-dom';
import { exportToCsv } from '../../utils/helpers';
import { formatEther, parseEther, parseGwei } from 'viem';
import { sendNotification } from '../../hooks/useWatcher/notifications';
import { HOPR_TOKEN_USED } from '../../../config';
import { utils as hoprdUtils } from '@hoprnet/hopr-sdk';
const { sdkApiError } = hoprdUtils;

// HOPR Components
import Section from '../../future-hopr-lib-components/Section';
import { SubpageTitle } from '../../components/SubpageTitle';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import CloseChannelIcon from '../../future-hopr-lib-components/Icons/CloseChannel';
import TablePro from '../../future-hopr-lib-components/Table/table-pro';
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
import { OpenMultipleChannelsModal } from '../../components/Modal/node/OpenMultipleChannelsModal';
import { PingModal } from '../../components/Modal/node/PingModal';
import { OpenChannelModal } from '../../components/Modal/node/OpenChannelModal';
import { FundChannelModal } from '../../components/Modal/node/FundChannelModal';
import { OpenSessionModal } from '../../components/Modal/node/OpenSessionModal';
import { CreateAliasModal } from '../../components/Modal/node//AddAliasModal';
//import { SendMessageModal } from '../../components/Modal/node/SendMessageModal.tsx_';

// Mui
import GetAppIcon from '@mui/icons-material/GetApp';

function ChannelsPage() {
  const dispatch = useAppDispatch();
  const channels = useAppSelector((store) => store.node.channels.data);
  const channelsOutgoingObject = useAppSelector((store) => store.node.channels.parsed.outgoing);
  const channelsOutgoing = useAppSelector((store) => store.node.channels.data?.outgoing);
  const channelsFetching = useAppSelector((store) => store.node.channels.isFetching);
  const aliases = useAppSelector((store) => store.node.aliases);
  const loginData = useAppSelector((store) => store.auth.loginData);
  const currentApiEndpoint = useAppSelector((store) => store.node.apiEndpoint);
  const tabLabel = 'outgoing';
  const channelsData = channels?.outgoing;
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
            estimatedSpent: blokliChannel?.estimatedValue?.formatted ?? '',
          };
        }),
        `${tabLabel}-channels.csv`,
      );
    }
  };

  const handleCloseChannels = (address: string) => {
    dispatch(
      actionsAsync.closeChannelThunk({
        apiEndpoint: loginData.apiEndpoint!,
        apiToken: loginData.apiToken ? loginData.apiToken : '',
        direction: 'outgoing',
        address: address,
        timeout: 5 * 60_000,
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

        if (
          e instanceof sdkApiError &&
          e.hoprdErrorPayload?.error?.includes('channel closure time has not elapsed yet, remaining')
        ) {
          const errMsg = `Closing of outgoing channel to ${address} halted. C${e.hoprdErrorPayload?.error.substring(
            1,
          )}`;
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
          return;
        }

        let errMsg = `Closing of outgoing channel to ${address} failed`;
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

  const header = [
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
    {
      key: 'actions',
      name: '',
      search: false,
    },
  ];

  const peersWithAliases = (channelsOutgoing || []).filter(
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
  const peersWithoutAliases = (channelsOutgoing || []).filter(
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
        !channelsOutgoingObject[id].peerAddress ||
        !channelsOutgoingObject[id].balance ||
        !channelsOutgoingObject[id].status
      )
        return;

      const peerAddress = channelsOutgoingObject[id].peerAddress;
      if (!peerAddress) return;
      const blokliChannel = blokliChannels.byId[id.toLowerCase()];

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
        statusText: statusWithClosure(channelsOutgoingObject[id].status as string, blokliChannel),
        status: <StatusPill status={statusWithClosure(channelsOutgoingObject[id].status as string, blokliChannel)} />,
        funds: (
          <TokenAmount
            value={channelsOutgoingObject[id].balance}
            unit={HOPR_TOKEN_USED}
          />
        ),
        ...blokliChannelCells(blokliChannel),
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
            <FundChannelModal address={peerAddress} />
            <IconButton
              iconComponent={<CloseChannelIcon />}
              pending={channelsOutgoingObject[id]?.isClosing}
              tooltipText={
                <span>
                  CLOSE
                  <br />
                  outgoing channel
                </span>
              }
              onClick={() => handleCloseChannels(peerAddress)}
            />
            <OpenSessionModal destination={peerAddress} />
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
        title={`OUTGOING CHANNELS (${channelsData ? channelsData.length : '-'})`}
        refreshFunction={handleRefresh}
        reloading={channelsFetching}
        actions={
          <>
            <OpenChannelModal />
            <OpenMultipleChannelsModal />
            <FundChannelModal />
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
        id={'node-channels-out-table'}
        header={header}
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
