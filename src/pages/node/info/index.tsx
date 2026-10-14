import { useState, useEffect, type CSSProperties } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { formatEther } from 'viem';

// Mui
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Visibility from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// HOPR Components
import Section from '../../../future-hopr-lib-components/Section';
import { actionsAsync as nodeActionsAsync } from '../../../store/slices/node/actionsAsync';
import { fetchBlokliData } from '../../../store/slices/blokli/fetchBlokliData';
import { fetchNetworkDashboardData } from '../../../store/slices/networkDashboard/fetchNetworkDashboardData';
import { selectBlokliUrl } from '../../../store/selectors/blokli';
import { SubpageTitle } from '../../../components/SubpageTitle';
import WithdrawModal from '../../../components/Modal/node/WithdrawModal';
import SmallActionButton from '../../../future-hopr-lib-components/Button/SmallActionButton';
import { shortenAddress } from '../../../utils/amount';
import { useHoprdUpdate } from '../../../hooks/useHoprdUpdate';
import IconButton from '../../../future-hopr-lib-components/Button/IconButton';
import Tooltip from '../../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';

//Icons
import DataObjectIcon from '@mui/icons-material/DataObject';

//Info Components
import { useUptime } from './node-uptime';
import Traffic from './traffic';
import Transport from './transport';
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
  const aliases = useAppSelector((store) => store.node.aliases);
  const nodeStartedEpoch = useAppSelector((store) => store.node.metricsParsed.nodeStartEpoch);
  const nodeStartedTime =
    nodeStartedEpoch && typeof nodeStartedEpoch === 'number'
      ? new Date(nodeStartedEpoch * 1000).toJSON().slice(0, 16).replace('T', ' ') + ' UTC'
      : '-';
  const uptime = useUptime();
  const nodeSync = useAppSelector((store) => store.node.metricsParsed.nodeSync);
  const ticketPrice = useAppSelector((store) => store.node.ticketPrice.data);
  const minimumNetworkProbability = useAppSelector((store) => store.node.probability.data);
  // blokli: safe wide channel stake and this node's on chain ticket redemptions
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const safeChannelsOut = useAppSelector((store) => store.blokli.channelStats.data);
  const channelStatsFetching = useAppSelector((store) => store.blokli.channelStats.isFetching);
  const ticketRedemption = useAppSelector((store) => store.blokli.ticketRedemption.data);
  const ticketRedemptionFetching = useAppSelector((store) => store.blokli.ticketRedemption.isFetching);
  const safeNodes = useAppSelector((store) => store.blokli.safeNodes.data);
  const safeNodesFetching = useAppSelector((store) => store.blokli.safeNodes.isFetching);
  const nodeChannelsOut = safeNodes?.find(
    (node) => node.nodeAddress.toLowerCase() === addresses?.native?.toLowerCase(),
  )?.channels;
  const dashboardFetching = useAppSelector((store) => store.networkDashboard.nodes.isFetching);
  const [showWholeProvider, set_showWholeProvider] = useState(false);
  const [providerShort, set_providerShort] = useState('');
  const [providerContainsSecret, set_providerContainsSecret] = useState(true);
  const provider = info?.providerUrl;

  useEffect(() => {
    fetchInfoData();
  }, [apiEndpoint, apiToken]);

  useEffect(() => {
    try {
      if (!provider) {
        set_providerShort('');
        return;
      }
      const providerObject = new URL(provider);
      const providerContainsSecret = providerObject.pathname !== '/' || providerObject.search !== '';
      set_providerContainsSecret(providerContainsSecret);
      const providerShort = providerContainsSecret ? providerObject.origin + '/************' : provider;
      set_providerShort(providerShort || '');
    } catch (e) {
      console.error('Error parsing provider URL', e);
      set_providerShort('***Invalid URL***');
    }
  }, [provider]);

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

  // This will allow us to improve readability on the reloading prop for SubpageTitle
  const isFetchingAnyData = [
    balancesFetching,
    addressesFetching,
    channelsFetching,
    versionFetching,
    infoFetching,
    peersConnectedFetching,
    peersAnnouncedFetching,
    channelStatsFetching,
    safeNodesFetching,
    ticketRedemptionFetching,
    dashboardFetching,
  ].includes(true);

  const totalStaked =
    safeChannelsOut?.value && balances.safeHopr?.value
      ? formatEther(BigInt(safeChannelsOut.value) + BigInt(balances.safeHopr.value))
      : null;

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
          label="Total staked"
          value={short(totalStaked)}
          unit="wxHOPR"
          className="highlight"
          sub="safe + safe channels"
          tip={`${
            totalStaked ?? '-'
          } wxHOPR staked in your Safe and in the outgoing channels of every node registered to it`}
        />
        <Kpi
          label="Safe"
          value={short(balances.safeHopr?.formatted)}
          unit="wxHOPR"
          sub={`allowance ${short(balances.safeHoprAllowance?.formatted).toLowerCase()}`}
          tip={`${balances.safeHopr?.formatted ?? '-'} wxHOPR stored on your Safe`}
        />
        <Kpi
          label="Node channels"
          value={short(nodeChannelsOut?.formatted)}
          unit="wxHOPR"
          sub={nodeChannelsOut ? `${nodeChannelsOut.count} channels` : '-'}
          tip="wxHOPR in this node's open outgoing channels. Read from blokli."
        />
        <Kpi
          label="Earned"
          value={short(ticketRedemption?.redeemed.formatted)}
          unit="wxHOPR"
          sub="redeemed on-chain"
          tip="wxHOPR this node redeemed from winning tickets. Read from blokli."
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
          <KV
            label="Provider"
            tip="The blokli provider address your node uses sync"
            mono
            actions={
              providerContainsSecret && (
                <SmallActionButton
                  tooltip={showWholeProvider ? 'Hide full URL' : 'Show full URL'}
                  onClick={() => set_showWholeProvider(!showWholeProvider)}
                >
                  {showWholeProvider ? <Visibility /> : <VisibilityOff />}
                </SmallActionButton>
              )
            }
          >
            {showWholeProvider ? provider : providerShort}
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
