import { useRef, useState } from 'react';
import styled from '@emotion/styled';
import { useAppDispatch, useAppSelector } from '../../store';
import { selectBlokliUrl, sumSafeNodes } from '../../store/selectors/blokli';
import { watchlistActionsAsync } from '../../store/slices/watchlist';
import { appActions } from '../../store/slices/app';
import { formatEther } from 'viem';
import type { SafeChannelStatsType, SafeNodeType } from '../../blokli';
import { shortenAddress, shrinkNumber } from '../../utils/amount';
import { exportToCsv } from '../../utils/helpers';
import { parseWatchlistFile } from '../../utils/watchlist';
import { sendNotification } from '../../hooks/useWatcher/notifications';
import { useVisibleInterval } from '../../hooks/usePageVisible';

// HOPR Components
import Section from '../../future-hopr-lib-components/Section';
import { SubpageTitle } from '../../components/SubpageTitle';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { NodesTable } from '../../components/NodesTable';
import { BreakdownTooltip, FiguresChip, type WalletItem } from '../../components/InfoBar';
import { AddressLinks, SafeWalletLink } from '../node/info/ui';
import { SafeNodesModal } from '../../components/Modal/watchlist/SafeNodesModal';
import { AddToWatchlistModal } from '../../components/Modal/watchlist/AddToWatchlistModal';
import { CreateAliasModal } from '../../components/Modal/node/AddAliasModal';
import { nodeChartTitle, safeChartTitle, useEarningsPopup, WatchlistEarnings } from '../../components/EarningsChart';

// Mui
import Button from '@mui/material/Button';
import DnsIcon from '@mui/icons-material/Dns';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';

const NO_SAFE = 'none';
const UNKNOWN_SAFE = 'unknown';

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 96px 16px;
  text-align: center;
  h3 {
    margin: 0;
    color: var(--text);
    font-size: clamp(28px, 6vw, 48px);
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
`;

// styled like the table header, it heads the nodes of one safe. The links and the
// count wrap under the address when the column is too narrow for one line
const GroupHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  min-width: 0;
  white-space: nowrap;
  .safe {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  @container (max-width: 600px) {
    .address {
      overflow-wrap: anywhere;
      white-space: normal;
    }
  }
  .label {
    color: var(--muted);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .name {
    min-width: 0;
    &.opens {
      cursor: pointer;
      &:hover .alias,
      &:hover .address {
        text-decoration: underline;
      }
    }
  }
  .named {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }
  .alias {
    font-weight: 600;
    color: var(--text);
  }
  .address {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text);
  }
  .alias + .address {
    color: var(--muted);
  }
  .links {
    display: inline-flex;
    align-items: center;
    svg {
      width: 15px;
      height: 15px;
      color: var(--muted);
    }
  }
  .count {
    color: var(--muted);
    font-size: 12px;
  }
`;

// 'watched/all nodes' of the safe, opens the picker of its nodes
const NodesButton = styled(Button)`
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  text-transform: none;
  white-space: nowrap;
  min-width: 0;
  padding: 0 6px;
  .MuiButton-startIcon {
    margin-right: 4px;
    svg {
      font-size: 16px;
    }
  }
  &:hover {
    color: var(--primary);
  }
`;

// the safe's wxHOPR and every node's channels, closing ones included, like Total staked on SAFE INFO
const safeTotal = (funds?: SafeChannelStatsType) =>
  funds?.safeBalance ? BigInt(funds.safeBalance.value) + BigInt(funds.value) + BigInt(funds.closing?.value ?? 0) : null;

// 'in safe / total' wxHOPR
const SafeBalance = ({ funds }: { funds?: SafeChannelStatsType }) => {
  const inSafe = funds?.safeBalance;
  const totalValue = safeTotal(funds);
  if (!inSafe || totalValue === null) return <>-</>;
  const total = formatEther(totalValue);
  return (
    <BreakdownTooltip
      title="Safe"
      items={[
        { key: 'safe', label: 'Balance', long: 'Balance', value: inSafe.formatted, unit: 'wxHOPR' },
        { key: 'total', label: 'Total balance', long: 'Total balance', value: total, unit: 'wxHOPR' },
      ]}
    >
      <span>
        {`${shrinkNumber(inSafe.formatted)} / ${shrinkNumber(total)}`}
        <span className="unit">wxHOPR</span>
      </span>
    </BreakdownTooltip>
  );
};

const noFigures = (nodeAddress: string): SafeNodeType => ({
  nodeAddress,
  xDai: null,
  channels: null,
  redeemed: null,
  spent: null,
  rpcBroken: false,
});

/**
 * Nodes picked on SAFE → NODES, grouped by the safe they are registered to. Every
 * figure comes from blokli, the Gnosis RPCs and the network dashboard, so the page
 * works without a connected node.
 */
function WatchlistPage() {
  const dispatch = useAppDispatch();
  const watchlist = useAppSelector((store) => store.app.watchlist);
  const aliases = useAppSelector((store) => store.app.aliases);
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const rpcUrls = useAppSelector((store) => store.app.configuration.rpc.urls);
  const connected = useAppSelector((store) => store.auth.status.connected);
  const data = useAppSelector((store) => store.watchlist.data);
  const isFetching = useAppSelector((store) => store.watchlist.isFetching);
  const [safeInModal, set_safeInModal] = useState<string | null>(null);
  // a safe entered in the add dialog, its nodes are not in the watchlist data yet
  const [addedSafe, set_addedSafe] = useState<{ safeAddress: string; nodes: string[] } | null>(null);
  const added = addedSafe && addedSafe.safeAddress === safeInModal ? addedSafe : null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchlistKey = watchlist.join(',');
  const rpcUrlsKey = rpcUrls.join(',');

  const fetchWatchlist = () => {
    if (!blokliUrl || watchlist.length === 0) return;
    return dispatch(watchlistActionsAsync.getWatchlistThunk({ blokliUrl, rpcUrls, nodeAddresses: watchlist }));
  };

  // logging in or out aborts every running request, the watchlist one included
  // a minute after the last refresh settled, paused while the tab is in the background or the window is minimised
  useVisibleInterval(fetchWatchlist, 60_000, [blokliUrl, rpcUrlsKey, watchlistKey, connected]);

  const handleExport = () => {
    exportToCsv(
      watchlist.map((node) => ({ node })),
      'watchlist.csv',
    );
  };

  // imported nodes are added, the ones already watched stay
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = typeof reader.result === 'string' ? parseWatchlistFile(reader.result) : [];
      const added = imported.filter((address) => !watchlist.includes(address));
      if (added.length)
        dispatch(appActions.setWatchedMany(Object.fromEntries(added.map((address) => [address, true]))));
      const msg = imported.length
        ? `Watchlist import: ${added.length} ${added.length === 1 ? 'node' : 'nodes'} added, ${
            imported.length - added.length
          } already watched`
        : 'Watchlist import: no address found in the file';
      sendNotification({
        notificationPayload: { source: 'node', name: msg, url: null, timeout: null },
        toastPayload: { message: msg, type: imported.length ? 'success' : 'error' },
        dispatch,
      });
    };
    reader.readAsText(file);
  };

  const loading = data === null && isFetching;
  const nodes = loading ? [] : watchlist.map((address) => data?.figuresByNode[address] ?? noFigures(address));

  // a node just picked in the dialog is known from its safe's node list until the next fetch
  const safeByListedNode = new Map(
    Object.entries(data?.nodesBySafe ?? {}).flatMap(([safe, nodes]) => nodes.map((node) => [node, safe] as const)),
  );
  const safeOf = (address: string) => {
    const safe = data?.safeByNode[address];
    return safe === undefined ? safeByListedNode.get(address) : safe;
  };

  const groupOf = (address: string) => {
    const safe = safeOf(address);
    return safe ? safe : safe === null ? NO_SAFE : UNKNOWN_SAFE;
  };

  const watchedNodesOf = (safeAddress: string) => watchlist.filter((address) => safeOf(address) === safeAddress);
  // the whole safe, like its row in the table, the watched nodes alone until blokli lists its nodes
  const chartNodesOf = (safeAddress: string) =>
    Array.from(new Set([...(data?.nodesBySafe[safeAddress] ?? []), ...watchedNodesOf(safeAddress)]));
  // a click on a node's or safe's name opens its earnings chart
  const chartPopup = useEarningsPopup();
  const openSafeChart = (safeAddress: string) => {
    const nodes = chartNodesOf(safeAddress);
    return chartPopup.opener(safeChartTitle(safeAddress, aliases[safeAddress], nodes.length), nodes);
  };

  // Total and Net of every safe in the list, each safe whole as its group row sums it; '-' until all are known
  const listedSafes = Array.from(new Set(watchlist.map(safeOf).filter((safe): safe is string => !!safe)));
  const safeTotals = listedSafes.map((safe) => safeTotal(data?.safeFunds[safe]));
  const total = safeTotals.every((value): value is bigint => value !== null)
    ? safeTotals.reduce((sum, value) => sum + value, BigInt(0))
    : null;
  const nodesOfSafes = listedSafes.map((safe) => data?.nodesBySafe[safe]);
  const netNodes = nodesOfSafes.every((nodes): nodes is string[] => !!nodes)
    ? Array.from(new Set([...nodesOfSafes.flat(), ...listedSafes.flatMap(watchedNodesOf)])).map(
        (address) => data?.figuresByNode[address] ?? noFigures(address),
      )
    : null;
  const earned = sumSafeNodes(netNodes, 'redeemed');
  const spent = sumSafeNodes(netNodes, 'spent');
  const net = earned !== null && spent !== null ? earned - spent : null;
  const totals: WalletItem[] = [
    {
      key: 'net',
      label: 'Net',
      long: 'Net (earned - spent)',
      value: net === null ? null : formatEther(net),
      unit: 'wxHOPR',
      broken: spent === null && !!netNodes?.some((node) => node.rpcBroken),
      tone: net === null ? undefined : net < BigInt(0) ? 'red' : 'green',
    },
    {
      key: 'total',
      label: 'Total',
      long: 'Total staked',
      value: total === null ? null : formatEther(total),
      unit: 'wxHOPR',
    },
  ];

  const renderGroupHeader = (groupId: string, rowCount: number) => {
    if (groupId === NO_SAFE || groupId === UNKNOWN_SAFE) {
      return {
        label: (
          <GroupHeader>
            <span className="label">
              {groupId === NO_SAFE
                ? 'Not registered to a safe'
                : isFetching
                ? 'Looking up the safe'
                : 'Safe unknown, blokli did not answer'}
            </span>
            <span className="count">{`${rowCount} ${rowCount === 1 ? 'node' : 'nodes'}`}</span>
          </GroupHeader>
        ),
      };
    }
    const watchedNodes = watchedNodesOf(groupId);
    const safeNodes = data?.nodesBySafe[groupId];
    const watched = watchedNodes.length;
    const all = safeNodes?.length;
    const openChart = openSafeChart(groupId);
    return {
      label: (
        <GroupHeader>
          <span className="safe">
            <span className="links">
              <SafeWalletLink safeAddress={groupId} />
            </span>
            <span
              className={openChart ? 'name opens' : 'name'}
              onClick={openChart}
            >
              {aliases[groupId] ? (
                // shortened in the middle under an alias, like the node rows
                <Tooltip title={groupId}>
                  <span className="named">
                    <span className="alias">{aliases[groupId]}</span>
                    <span className="address">{shortenAddress(groupId)}</span>
                  </span>
                </Tooltip>
              ) : (
                <span className="address">{groupId}</span>
              )}
            </span>
          </span>
          <span className="links">
            <AddressLinks address={groupId} />
          </span>
        </GroupHeader>
      ),
      balance: <SafeBalance funds={data?.safeFunds[groupId]} />,
      actions: (
        <>
          <CreateAliasModal address={groupId} />
          <NodesButton
            size="small"
            startIcon={<DnsIcon />}
            onClick={() => set_safeInModal(groupId)}
            title="Pick the nodes of this safe to watch"
          >
            {all === undefined ? `${watched} ${watched === 1 ? 'node' : 'nodes'}` : `${watched}/${all} nodes`}
          </NodesButton>
        </>
      ),
      // the whole safe, watched or not, unknown while blokli did not list its nodes
      sumOver: safeNodes
        ? Array.from(new Set([...safeNodes, ...watchedNodes])).map(
            (address) => data?.figuresByNode[address] ?? noFigures(address),
          )
        : null,
    };
  };

  return (
    <Section
      className="Section--watchlist"
      id="Section--watchlist"
      fullHeightMin
      yellow
    >
      <SubpageTitle
        title={`WATCHLIST (${watchlist.length})`}
        refreshFunction={watchlist.length ? fetchWatchlist : undefined}
        reloading={isFetching}
        actions={
          <>
            <AddToWatchlistModal
              onSafe={(safeAddress, nodes) => {
                set_addedSafe({ safeAddress, nodes });
                set_safeInModal(safeAddress);
              }}
            />
            <IconButton
              iconComponent={<UploadFileIcon />}
              tooltipText={
                <span>
                  IMPORT
                  <br />
                  nodes from a CSV
                </span>
              }
              onClick={() => fileInputRef.current?.click()}
            />
            <IconButton
              iconComponent={<SaveIcon />}
              tooltipText={
                <span>
                  EXPORT
                  <br />
                  the watchlist as a CSV
                </span>
              }
              disabled={watchlist.length === 0}
              onClick={handleExport}
            />
            <input
              type="file"
              accept=".csv,.txt"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleImport}
            />
          </>
        }
      />
      {watchlist.length === 0 ? (
        <Empty>
          <h3>Nothing watched yet</h3>
          <p>
            Add a node or a safe with +, or tick the box next to a node on SAFE → NODES, with or without a node
            connected.
          </p>
        </Empty>
      ) : (
        <NodesTable
          id="watchlist-table"
          nodes={nodes}
          stats={data?.stats}
          loading={loading}
          removable
          groupOf={groupOf}
          renderGroupHeader={renderGroupHeader}
          nodeOpener={(address) => chartPopup.opener(nodeChartTitle(address, aliases[address]), [address])}
          toolbarCenter={
            listedSafes.length > 0 && (
              <FiguresChip
                title={`${listedSafes.length} ${listedSafes.length === 1 ? 'safe' : 'safes'} in the watchlist`}
                items={totals}
              />
            )
          }
        />
      )}
      <WatchlistEarnings
        nodes={watchlist}
        safes={listedSafes.map((safe) => ({ safe, nodes: chartNodesOf(safe) }))}
      />
      {chartPopup.popup}
      <SafeNodesModal
        safeAddress={safeInModal}
        nodes={safeInModal ? added?.nodes ?? data?.nodesBySafe[safeInModal] : undefined}
        watchedNodes={safeInModal ? watchedNodesOf(safeInModal) : []}
        preselect={added?.nodes}
        onClose={() => {
          set_safeInModal(null);
          set_addedSafe(null);
        }}
      />
    </Section>
  );
}

export default WatchlistPage;
