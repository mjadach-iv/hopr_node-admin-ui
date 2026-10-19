import { useEffect, type CSSProperties } from 'react';
import { formatEther } from 'viem';
import { RpcError } from '../../../components/RpcError';
import { useAppDispatch, useAppSelector } from '../../../store';

// Mui
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// HOPR Components
import Section from '../../../future-hopr-lib-components/Section';
import { actionsAsync as nodeActionsAsync } from '../../../store/slices/node/actionsAsync';
import { fetchBlokliData } from '../../../store/slices/blokli/fetchBlokliData';
import { fetchNetworkDashboardData } from '../../../store/slices/networkDashboard/fetchNetworkDashboardData';
import { selectBlokliUrl } from '../../../store/selectors/blokli';
import { blokliGraphqlUrl } from '../../../blokli/client';
import { SubpageTitle } from '../../../components/SubpageTitle';
import WithdrawModal from '../../../components/Modal/node/WithdrawModal';
import { shortenAddress } from '../../../utils/amount';
import { useHoprdUpdate } from '../../../hooks/useHoprdUpdate';
import IconButton from '../../../future-hopr-lib-components/Button/IconButton';
import Tooltip from '../../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';

//Icons
import DataObjectIcon from '@mui/icons-material/DataObject';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

//Info Components
import { useUptime } from './node-uptime';
import Traffic from './traffic';
import Transport from './transport';
import Tickets from './tickets';
import NetworkDashboard from './networkDashboard';
import { AddressLinks, Card, CardGrid, KV, Kpi, KpiGrid, SafeWalletLink, short } from './ui';

function InfoPage() {
  const dispatch = useAppDispatch();
  const { apiEndpoint, apiToken } = useAppSelector((store) => store.auth.loginData);
  const balances = useAppSelector((store) => store.node.balances.data);
  const balancesFetching = useAppSelector((store) => store.node.balances.isFetching);
  const addresses = useAppSelector((store) => store.node.addresses.data);
  const addressesFetching = useAppSelector((store) => store.node.addresses.isFetching);
  const channels = useAppSelector((store) => store.node.channels.data);
  const channelsFetching = useAppSelector((store) => store.node.channels.isFetching);
  const version = useAppSelector((store) => store.node.version.data);
  const versionFetching = useAppSelector((store) => store.node.version.isFetching);
  const hoprdUpdate = useHoprdUpdate();
  const info = useAppSelector((store) => store.node.info.data);
  const infoFetching = useAppSelector((store) => store.node.info.isFetching);
  const peersAnnounced = useAppSelector((store) => store.node.peersAnnounced.data);
  const peersAnnouncedFetching = useAppSelector((store) => store.node.peersAnnounced.isFetching);
  const peersConnected = useAppSelector((store) => store.node.peersConnected.data);
  const peersConnectedFetching = useAppSelector((store) => store.node.peersConnected.isFetching);
  const aliases = useAppSelector((store) => store.app.aliases);
  const nodeStartedEpoch = useAppSelector((store) => store.node.metricsParsed.nodeStartEpoch);
  const nodeStartedTime =
    nodeStartedEpoch && typeof nodeStartedEpoch === 'number'
      ? new Date(nodeStartedEpoch * 1000).toJSON().slice(0, 16).replace('T', ' ') + ' UTC'
      : '-';
  const uptime = useUptime();
  const nodeSync = useAppSelector((store) => store.node.metricsParsed.nodeSync);
  const ticketPrice = useAppSelector((store) => store.node.ticketPrice.data);
  const minimumNetworkProbability = useAppSelector((store) => store.node.probability.data);
  const statisticsFetching = useAppSelector((store) => store.node.statistics.isFetching);
  const redeemAllTicketsFetching = useAppSelector((store) => store.node.redeemAllTickets.isFetching);
  // blokli: safe wide channel stake and this node's on chain ticket redemptions
  const blokliUrl = useAppSelector(selectBlokliUrl);
  // origin only, the url may carry an api key in its path
  const blokliOrigin = (() => {
    try {
      return blokliUrl ? new URL(blokliUrl).origin : null;
    } catch {
      return blokliUrl;
    }
  })();
  const channelStatsFetching = useAppSelector((store) => store.blokli.channelStats.isFetching);
  const ticketRedemption = useAppSelector((store) => store.blokli.ticketRedemption.data);
  const ticketRedemptionFetching = useAppSelector((store) => store.blokli.ticketRedemption.isFetching);
  const safeNodes = useAppSelector((store) => store.blokli.safeNodes.data);
  const safeNodesFetching = useAppSelector((store) => store.blokli.safeNodes.isFetching);
  const safeNode = safeNodes?.find((node) => node.nodeAddress.toLowerCase() === addresses?.native?.toLowerCase());
  const nodeChannelsOut = safeNode?.channels;
  const nodeSpent = safeNode?.spent;
  const rpcBroken = !nodeSpent && !!safeNode?.rpcBroken;
  const dashboardFetching = useAppSelector((store) => store.networkDashboard.nodes.isFetching);
  useEffect(() => {
    fetchInfoData();
  }, [apiEndpoint, apiToken]);

  const fetchInfoData = () => {
    if (!apiEndpoint) return;

    dispatch(
      nodeActionsAsync.getBalancesThunk({
        apiEndpoint,
        apiToken: apiToken ? apiToken : '',
      }),
    );
    dispatch(
      nodeActionsAsync.getChannelsThunk({
        apiEndpoint,
        apiToken: apiToken ? apiToken : '',
      }),
    );
    dispatch(
      nodeActionsAsync.getAddressesThunk({
        apiEndpoint,
        apiToken: apiToken ? apiToken : '',
      }),
    );
    dispatch(
      nodeActionsAsync.getVersionThunk({
        apiEndpoint,
        apiToken: apiToken ? apiToken : '',
      }),
    );
    dispatch(
      nodeActionsAsync.getInfoThunk({
        apiEndpoint,
        apiToken: apiToken ? apiToken : '',
      }),
    );
    dispatch(
      nodeActionsAsync.getConnectedPeersThunk({
        apiEndpoint,
        apiToken: apiToken ? apiToken : '',
      }),
    );
    dispatch(
      nodeActionsAsync.getAnnouncedPeersThunk({
        apiEndpoint,
        apiToken: apiToken ? apiToken : '',
      }),
    );
    dispatch(
      nodeActionsAsync.getTicketStatisticsThunk({
        apiEndpoint,
        apiToken: apiToken ? apiToken : '',
      }),
    );
    fetchBlokliData({
      blokliUrl,
      nodeAddress: addresses?.native,
      safeAddress: info?.hoprNodeSafe,
      dispatch,
    });
    fetchNetworkDashboardData({
      networkName: info?.hoprNetworkName,
      nodeAddress: addresses?.native,
      safeNodeAddresses: (safeNodes ?? []).map((node) => node.nodeAddress),
      dispatch,
    });
  };

  const handleRedeemAllTickets = () => {
    if (!apiEndpoint) return;

    dispatch(
      nodeActionsAsync.redeemAllTicketsThunk({
        apiEndpoint,
        apiToken: apiToken ? apiToken : '',
      }),
    )
      .unwrap()
      .then(() => {
        fetchInfoData();
      });
  };

  // This will allow us to improve readability on the reloading prop for SubpageTitle
  const isFetchingAnyData = [
    balancesFetching,
    addressesFetching,
    channelsFetching,
    versionFetching,
    infoFetching,
    peersConnectedFetching,
    peersAnnouncedFetching,
    statisticsFetching,
    channelStatsFetching,
    safeNodesFetching,
    ticketRedemptionFetching,
    dashboardFetching,
  ].includes(true);

  const net = ticketRedemption && nodeSpent ? BigInt(ticketRedemption.redeemed.value) - BigInt(nodeSpent.value) : null;

  // check if user is logged in
  if (!apiEndpoint) {
    return (
      <Section
        className="Section--selectNode"
        id="Section--selectNode"
        yellow
        fullHeightMin
      >
        Login to node
      </Section>
    );
  }

  return (
    <Section
      className="Section--selectNode"
      id="Section--selectNode"
      fullHeightMin
      yellow
    >
      <SubpageTitle
        title="NODE INFO"
        refreshFunction={fetchInfoData}
        reloading={isFetchingAnyData}
        actions={
          <>
            <WithdrawModal />
            <IconButton
              iconComponent={<ExitToAppIcon />}
              tooltipText={
                <span>
                  REDEEM
                  <br />
                  all tickets
                </span>
              }
              reloading={redeemAllTicketsFetching}
              onClick={handleRedeemAllTickets}
            />
            <IconButton
              iconComponent={<DataObjectIcon />}
              tooltipText={
                <span>
                  OPEN
                  <br />
                  Swagger UI
                </span>
              }
              onClick={() => {
                const externalUrl = apiEndpoint + '/swagger-ui/index.html#/';
                const w = window.open(externalUrl, '_blank');
                w && w.focus();
              }}
            />
            <IconButton
              iconComponent={
                <span
                  className="mask-icon"
                  style={{ '--icon': 'url(/assets/scalar-removebg-preview.png)' } as CSSProperties}
                />
              }
              tooltipText={
                <span>
                  OPEN
                  <br />
                  Scalar UI
                </span>
              }
              onClick={() => {
                const externalUrl = apiEndpoint + '/scalar';
                const w = window.open(externalUrl, '_blank');
                w && w.focus();
              }}
            />
          </>
        }
      />
      <KpiGrid>
        <Kpi
          label="Status"
          value={info?.connectivityStatus ?? '-'}
          className={`tone-${
            (info?.connectivityStatus ?? '').toLowerCase() === 'green'
              ? 'green'
              : info?.connectivityStatus === 'Red'
              ? 'red'
              : 'orange'
          }`}
          sub={
            <>
              up {uptime} ·{' '}
              {hoprdUpdate ? (
                <Tooltip
                  title={`hoprd ${hoprdUpdate} is available, update your node`}
                  notWide
                >
                  <span className="outdated own-tip">
                    {version?.replaceAll('"', '')}
                    <WarningAmberIcon className="update" />
                  </span>
                </Tooltip>
              ) : (
                version?.replaceAll('"', '') ?? '-'
              )}
            </>
          }
          tip="Connectivity status: Unknown right after start, Red no connection, Orange low quality, Yellow/Green high quality"
        />
        <Kpi
          label="Node gas"
          value={short(balances.native?.formatted)}
          unit="xDAI"
          sub={`safe ${short(balances.safeNative?.formatted)} xDAI`}
          tip={`${balances.native?.formatted ?? '-'} xDAI on the node, used to pay for transactions`}
        />
        <Kpi
          label="Node channels"
          value={short(nodeChannelsOut?.formatted)}
          unit="wxHOPR"
          sub={nodeChannelsOut ? `${nodeChannelsOut.count} channels` : '-'}
          tip="wxHOPR in this node's open outgoing channels. Read from blokli."
        />
        <Kpi
          label="Net"
          value={
            rpcBroken ? (
              <RpcError />
            ) : net !== null && net < BigInt(0) ? (
              `-${short(formatEther(-net))}`
            ) : (
              short(net === null ? null : formatEther(net))
            )
          }
          unit={rpcBroken ? undefined : 'wxHOPR'}
          className={rpcBroken ? 'tone-red' : net === null ? '' : net < BigInt(0) ? 'tone-red' : 'tone-green'}
          sub="earned - spent"
          tip={`${net === null ? '-' : formatEther(net)} wxHOPR this node earned beyond what it spent`}
        />
        <Kpi
          label="Earned"
          value={short(ticketRedemption?.redeemed.formatted)}
          unit="wxHOPR"
          sub="redeemed on-chain"
          tip="wxHOPR this node redeemed from winning tickets. Read from blokli."
        />
        <Kpi
          label="Spent"
          value={rpcBroken ? <RpcError /> : short(nodeSpent?.formatted)}
          unit={rpcBroken ? undefined : 'wxHOPR'}
          className={rpcBroken ? 'tone-red' : ''}
          sub="redeemed by counterparties"
          tip={`${
            nodeSpent?.formatted ?? '-'
          } wxHOPR redeemed from the channels this node opened, closed ones included`}
        />
        <Kpi
          label="Peers"
          value={peersConnected?.length ?? '-'}
          to="/networking/peers"
          sub={`${peersAnnounced?.length ?? '-'} announced`}
          tip="Nodes your node can reach, and all announced nodes it can see"
        />
        <Kpi
          label="Channels"
          value={
            <>
              {channels?.incoming.length ?? '-'}
              <span className="unit">in</span> {channels?.outgoing.length ?? '-'}
              <span className="unit">out</span>
            </>
          }
          to="/networking/channels-OUTGOING"
          sub={`ticket ${ticketPrice ?? '-'}`}
          tip="Open incoming and outgoing channels of this node, and the current price of a ticket"
        />
      </KpiGrid>

      <CardGrid>
        <Card
          title="Traffic"
          extra={<span>since start · 5 s rate</span>}
        >
          <Traffic />
        </Card>

        <Transport />

        <NetworkDashboard />

        <Tickets />

        <Card title="Node & network">
          <KV
            label="Network"
            tip="The HOPR network your node is running on"
          >
            {info?.hoprNetworkName ? info.hoprNetworkName : '-'}
          </KV>
          <KV
            label="Started"
            tip="Date when you node was started"
          >
            {nodeStartedTime}
          </KV>
          <KV
            label="Min. win probability"
            tip="Minimum allowed winning probability of the ticket as defined in the network"
          >
            {minimumNetworkProbability ? minimumNetworkProbability.toPrecision(3) : '-'}
          </KV>
        </Card>

        <Card title="Addresses">
          <KV
            label="Node"
            tip="Your node's Ethereum address"
            mono
            title={addresses?.native ?? ''}
            actions={addresses?.native && <AddressLinks address={addresses.native} />}
          >
            {addresses?.native ? shortenAddress(addresses.native) : '-'}
          </KV>
          <KV
            label="Safe"
            tip="Your safe's Ethereum address"
            mono
            title={info?.hoprNodeSafe ?? ''}
            leading={info?.hoprNodeSafe && <SafeWalletLink safeAddress={info.hoprNodeSafe} />}
            actions={info?.hoprNodeSafe && <AddressLinks address={info.hoprNodeSafe} />}
          >
            {info?.hoprNodeSafe ? shortenAddress(info.hoprNodeSafe) : '-'}
          </KV>
          <KV
            label="Blokli provider"
            tip="The blokli indexer on-chain data is read from. Opens its GraphQL IDE"
            mono
          >
            {blokliUrl ? (
              <a
                href={blokliGraphqlUrl(blokliUrl)}
                target="_blank"
                rel="noreferrer"
              >
                {blokliOrigin}
              </a>
            ) : (
              '-'
            )}
          </KV>
          <KV
            label="Announced"
            tip="The address your node announces to make itself reachable for other nodes"
            mono
            title={String(info?.announcedAddress ?? '')}
          >
            {info?.announcedAddress}
          </KV>
          <KV
            label="Listening"
            tip="The address your node uses to listen for incoming connections"
            mono
            title={String(info?.listeningAddress ?? '')}
          >
            {info?.listeningAddress}
          </KV>
        </Card>
      </CardGrid>
    </Section>
  );
}

export default InfoPage;
