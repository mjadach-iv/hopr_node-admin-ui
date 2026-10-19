import { useEffect } from 'react';
import styled from '@emotion/styled';
import { formatEther } from 'viem';
import { RpcError } from '../../components/RpcError';
import { useAppDispatch, useAppSelector } from '../../store';
import { actionsAsync as nodeActionsAsync } from '../../store/slices/node/actionsAsync';
import { fetchBlokliData } from '../../store/slices/blokli/fetchBlokliData';
import { fetchNetworkDashboardData } from '../../store/slices/networkDashboard/fetchNetworkDashboardData';
import { selectBlokliUrl, selectSafeFunds, sumSafeNodes } from '../../store/selectors/blokli';
import { utils as dashboardUtils, api as dashboardApi } from '../../networkDashboard';
import type { NodeStatsType } from '../../networkDashboard';
import { shortenAddress } from '../../utils/amount';

// HOPR Components
import Section from '../../future-hopr-lib-components/Section';
import { SubpageTitle } from '../../components/SubpageTitle';
import { WithUnit } from '../../components/Unit';
import { AddressLinks, Card, KV, Kpi, KpiGrid, SafeWalletLink, Stat, Stats, short } from '../node/info/ui';

// same columns as the node page's CardGrid (min 360px, max 3), but filled left to right
const CardRow = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, max(360px, calc((100% - 24px) / 3 - 1px))), 1fr));
  align-items: start;
  gap: 12px;
`;

const { formatAvailability, formatLatency, formatMbps } = dashboardUtils;

// below this a node can only pay for a handful of transactions
const LOW_XDAI = BigInt('50000000000000000');

const toFormatted = (value: bigint | null) => (value === null ? null : formatEther(value));

const average = (values: (number | null | undefined)[]) => {
  const known = values.filter((value): value is number => typeof value === 'number');
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
};

const sum = (values: (number | null | undefined)[]) => {
  const known = values.filter((value): value is number => typeof value === 'number');
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
};

/**
 * Totals over the safe of the connected node and every node registered to it,
 * the safe wide counterpart of the node info page. On-chain figures come from
 * blokli, availability and throughput from the network dashboard.
 */
function SafeInfoPage() {
  const dispatch = useAppDispatch();
  const { apiEndpoint, apiToken } = useAppSelector((store) => store.auth.loginData);
  const balances = useAppSelector((store) => store.node.balances.data);
  const balancesFetching = useAppSelector((store) => store.node.balances.isFetching);
  const nodeAddress = useAppSelector((store) => store.node.addresses.data.native);
  const info = useAppSelector((store) => store.node.info.data);
  const aliases = useAppSelector((store) => store.app.aliases);
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const safeFunds = useAppSelector(selectSafeFunds);
  const channelStatsFetching = useAppSelector((store) => store.blokli.channelStats.isFetching);
  const safeNodes = useAppSelector((store) => store.blokli.safeNodes.data);
  const safeNodesFetching = useAppSelector((store) => store.blokli.safeNodes.isFetching);
  const dashboardEnvId = useAppSelector((store) => store.networkDashboard.envId);
  const dashboardNodes = useAppSelector((store) => store.networkDashboard.nodes.data);
  const dashboardFetching = useAppSelector((store) => store.networkDashboard.nodes.isFetching);
  const safeAddress = info?.hoprNodeSafe;
  const safeNodeAddressesKey = (safeNodes ?? []).map((node) => node.nodeAddress).join(',');

  useEffect(() => {
    fetchNetworkDashboardData({
      networkName: info?.hoprNetworkName,
      nodeAddress,
      safeNodeAddresses: safeNodeAddressesKey ? safeNodeAddressesKey.split(',') : [],
      dispatch,
    });
  }, [info?.hoprNetworkName, nodeAddress, safeNodeAddressesKey]);

  const fetchSafeInfoData = () => {
    if (!apiEndpoint) return;
    dispatch(nodeActionsAsync.getBalancesThunk({ apiEndpoint, apiToken: apiToken ? apiToken : '' }));
    fetchBlokliData({ blokliUrl, nodeAddress, safeAddress, dispatch });
    fetchNetworkDashboardData({
      networkName: info?.hoprNetworkName,
      nodeAddress,
      safeNodeAddresses: (safeNodes ?? []).map((node) => node.nodeAddress),
      dispatch,
    });
  };

  const isFetchingAnyData = [balancesFetching, channelStatsFetching, safeNodesFetching, dashboardFetching].includes(
    true,
  );

  const totalStaked = safeFunds.total?.formatted ?? null;
  const earned = sumSafeNodes(safeNodes, 'redeemed');
  const spent = sumSafeNodes(safeNodes, 'spent');
  const net = earned !== null && spent !== null ? earned - spent : null;
  const rpcBroken = spent === null && !!safeNodes?.some((node) => node.rpcBroken);
  const nodesXDai = sumSafeNodes(safeNodes, 'xDai');
  const lowXDaiNodes = safeNodes?.filter((node) => node.xDai && BigInt(node.xDai.value) < LOW_XDAI).length;

  const nodeStats = (safeNodes ?? [])
    .map((node) => dashboardNodes?.byAddress[node.nodeAddress])
    .filter((stats): stats is NodeStatsType => !!stats);
  const pick = (
    key: 'availability24h' | 'availability7d' | 'availability30d' | 'latency' | 'lastThroughput' | 'throughput24h',
  ) => nodeStats.map((stats) => stats[key]);
  const averageLatency = average(pick('latency'));

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
        title="SAFE INFO"
        refreshFunction={fetchSafeInfoData}
        reloading={isFetchingAnyData}
      />
      <KpiGrid>
        <Kpi
          label="Total staked"
          value={short(totalStaked)}
          unit="wxHOPR"
          className="highlight"
          sub={`${short(safeFunds.inTransit?.formatted)} wxHOPR in transit`}
          tip={`${
            totalStaked ?? '-'
          } wxHOPR staked in your Safe and in the outgoing channels of every node registered to it. ${
            safeFunds.inTransit?.formatted ?? '-'
          } wxHOPR of it is in transit: held by closing channels until their closure is finalized and the funds return to the Safe`}
        />
        <Kpi
          label="Safe"
          value={short(safeFunds.safe?.formatted)}
          unit="wxHOPR"
          sub={`allowance ${short(balances.safeHoprAllowance?.formatted).toLowerCase()}`}
          tip={`${safeFunds.safe?.formatted ?? '-'} wxHOPR stored on your Safe`}
        />
        <Kpi
          label="Safe channels"
          value={short(safeFunds.channels?.formatted)}
          unit="wxHOPR"
          sub={
            safeFunds.openCount === null
              ? '-'
              : `${safeFunds.openCount} channels${safeFunds.closingCount ? ` · ${safeFunds.closingCount} closing` : ''}`
          }
          tip="wxHOPR in the outgoing channels of every node registered to your Safe, closing ones included until their funds return to the Safe. Read from blokli."
        />
        <Kpi
          label="Net"
          value={
            rpcBroken ? (
              <RpcError />
            ) : net !== null && net < BigInt(0) ? (
              `-${short(formatEther(-net))}`
            ) : (
              short(toFormatted(net))
            )
          }
          unit={rpcBroken ? undefined : 'wxHOPR'}
          className={rpcBroken ? 'tone-red' : net === null ? '' : net < BigInt(0) ? 'tone-red' : 'tone-green'}
          sub="earned - spent"
          tip={`${toFormatted(net) ?? '-'} wxHOPR the safe's nodes earned beyond what they spent`}
        />
        <Kpi
          label="Earned"
          value={short(toFormatted(earned))}
          unit="wxHOPR"
          sub="redeemed on-chain"
          tip={`${toFormatted(earned) ?? '-'} wxHOPR the safe's nodes redeemed from winning tickets. Read from blokli.`}
        />
        <Kpi
          label="Spent"
          value={rpcBroken ? <RpcError /> : short(toFormatted(spent))}
          unit={rpcBroken ? undefined : 'wxHOPR'}
          className={rpcBroken ? 'tone-red' : ''}
          sub="redeemed by counterparties"
          tip={`${
            toFormatted(spent) ?? '-'
          } wxHOPR redeemed from the channels the safe's nodes opened, closed ones included`}
        />
        <Kpi
          label="Nodes"
          value={safeNodes?.length ?? '-'}
          to="/safe/nodes"
          className={lowXDaiNodes ? 'tone-orange' : ''}
          sub={lowXDaiNodes === undefined ? '-' : lowXDaiNodes ? `${lowXDaiNodes} low on xDAI` : 'all funded'}
          tip="Nodes registered to your Safe, and how many have less than 0.05 xDAI for transactions"
        />
        <Kpi
          label="Gas"
          value={short(toFormatted(nodesXDai))}
          unit="xDAI"
          sub={`safe ${short(balances.safeNative?.formatted)} xDAI`}
          tip={`${toFormatted(nodesXDai) ?? '-'} xDAI on all nodes of the safe, used to pay for transactions`}
        />
      </KpiGrid>

      <CardRow>
        <Card title="Addresses">
          <KV
            label="Safe"
            tip="Your safe's Ethereum address"
            mono
            title={safeAddress ?? ''}
            leading={safeAddress && <SafeWalletLink safeAddress={safeAddress} />}
            actions={safeAddress && <AddressLinks address={safeAddress} />}
          >
            {safeAddress ? shortenAddress(safeAddress) : '-'}
          </KV>
          {(safeNodes ?? []).map((node) => (
            <KV
              key={node.nodeAddress}
              label={
                aliases?.[node.nodeAddress] ??
                (node.nodeAddress.toLowerCase() === nodeAddress?.toLowerCase() ? 'This node' : 'Node')
              }
              tip="A node registered to your safe"
              mono
              title={node.nodeAddress}
              actions={<AddressLinks address={node.nodeAddress} />}
            >
              {shortenAddress(node.nodeAddress)}
            </KV>
          ))}
        </Card>

        <Card
          title="Network dashboard"
          extra={
            <a
              href={dashboardApi.NETWORK_DASHBOARD_URL}
              target="_blank"
              rel="noreferrer"
            >
              network.hoprnet.org ↗
            </a>
          }
        >
          {dashboardEnvId === null ? (
            <KV
              label="Tracked"
              tip="Only networks listed on network.hoprnet.org have dashboard figures"
            >
              {`${info?.hoprNetworkName ?? '-'} is not tracked`}
            </KV>
          ) : (
            <>
              <Stats>
                <Stat
                  label="Availability 24h"
                  value={formatAvailability(average(pick('availability24h')))}
                  meter={average(pick('availability24h'))}
                  tip="Average share of the dashboard's pings the safe's nodes answered in the last 24 hours"
                />
                <Stat
                  label="7d"
                  value={formatAvailability(average(pick('availability7d')))}
                  meter={average(pick('availability7d'))}
                  tip="Average share of the dashboard's pings the safe's nodes answered in the last 7 days"
                />
                <Stat
                  label="30d"
                  value={formatAvailability(average(pick('availability30d')))}
                  meter={average(pick('availability30d'))}
                  tip="Average share of the dashboard's pings the safe's nodes answered in the last 30 days"
                />
              </Stats>
              <KV
                label="Tracked nodes"
                tip="Safe nodes the dashboard has figures for"
              >
                {safeNodes ? `${nodeStats.length} of ${safeNodes.length}` : '-'}
              </KV>
              <KV
                label="Latency"
                tip="Average of the nodes' median ping latency in the last 24 hours"
              >
                <WithUnit text={formatLatency(averageLatency === null ? null : Math.round(averageLatency))} />
              </KV>
              <KV
                label="Throughput last / 24h"
                tip="Relay throughput of all safe nodes added up, in the most recent hour each was tested and on average during cover traffic bursts in the last 24 hours"
              >
                <WithUnit text={formatMbps(sum(pick('lastThroughput')))} /> /{' '}
                <WithUnit text={formatMbps(sum(pick('throughput24h')))} />
              </KV>
            </>
          )}
        </Card>
      </CardRow>
    </Section>
  );
}

export default SafeInfoPage;
